package middleware

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// visitor is a token bucket for a single client key. Tokens refill at `rate`
// per second up to `burst`; each request costs one token.
type visitor struct {
	tokens   float64
	lastSeen time.Time
}

// RateLimiter is a small in-process token-bucket limiter keyed by client IP.
//
// It is intentionally simple and in-memory: it protects a single instance
// against brute-force bursts on sensitive endpoints (e.g. login) without any
// external dependency. In a multi-replica deployment each instance limits
// independently — a shared store (Redis) would be the production upgrade, which
// is why the limiter is isolated behind this type.
type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*visitor
	rate    float64
	burst   float64
	ttl     time.Duration
}

// NewRateLimiter builds a limiter allowing `rate` requests/second per client
// with bursts up to `burst`. Idle buckets are evicted after `ttl`.
func NewRateLimiter(rate, burst float64, ttl time.Duration) *RateLimiter {
	rl := &RateLimiter{
		buckets: make(map[string]*visitor),
		rate:    rate,
		burst:   burst,
		ttl:     ttl,
	}
	return rl
}

// allow reports whether a request from key may proceed, consuming a token if so.
func (rl *RateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	v, ok := rl.buckets[key]
	if !ok {
		rl.buckets[key] = &visitor{tokens: rl.burst - 1, lastSeen: now}
		rl.evictLocked(now)
		return true
	}

	// Refill based on elapsed time, capped at burst.
	elapsed := now.Sub(v.lastSeen).Seconds()
	v.tokens = minFloat(rl.burst, v.tokens+elapsed*rl.rate)
	v.lastSeen = now

	if v.tokens < 1 {
		return false
	}
	v.tokens--
	return true
}

// evictLocked drops buckets not seen within ttl. Caller must hold the mutex.
func (rl *RateLimiter) evictLocked(now time.Time) {
	for k, v := range rl.buckets {
		if now.Sub(v.lastSeen) > rl.ttl {
			delete(rl.buckets, k)
		}
	}
}

// LimitPath returns middleware that rate-limits (by client IP) only requests
// matching method+path — e.g. POST /dashboard/v1/auth/login — and passes
// everything else straight through. Over-limit requests get a spec-shaped 429.
func (rl *RateLimiter) LimitPath(method, path string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == method && r.URL.Path == path && !rl.allow(clientIP(r)) {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", "60")
				w.WriteHeader(http.StatusTooManyRequests)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"code":    http.StatusTooManyRequests,
					"message": "too many requests, please try again later",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// clientIP extracts the best-effort client IP, honouring the left-most
// X-Forwarded-For entry when present, else falling back to RemoteAddr.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		first, _, _ := strings.Cut(xff, ",")
		return strings.TrimSpace(first)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
