package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// newReq builds a POST to the login path from a given client IP.
func newReq(ip string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "/dashboard/v1/auth/login", nil)
	r.RemoteAddr = ip + ":12345"
	return r
}

func TestRateLimiter_BlocksAfterBurst(t *testing.T) {
	// 0 refill/sec so the burst is the only allowance within the test window.
	rl := NewRateLimiter(0, 3, time.Minute)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	h := rl.LimitPath(http.MethodPost, "/dashboard/v1/auth/login")(next)

	ok := 0
	limited := 0
	for i := 0; i < 5; i++ {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, newReq("1.2.3.4"))
		switch rec.Code {
		case http.StatusOK:
			ok++
		case http.StatusTooManyRequests:
			limited++
		}
	}
	if ok != 3 || limited != 2 {
		t.Fatalf("expected 3 allowed + 2 limited, got allowed=%d limited=%d", ok, limited)
	}
}

func TestRateLimiter_PerIPIsolation(t *testing.T) {
	rl := NewRateLimiter(0, 1, time.Minute)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	h := rl.LimitPath(http.MethodPost, "/dashboard/v1/auth/login")(next)

	// Different IPs must not share a bucket: each gets its own first token.
	for _, ip := range []string{"1.1.1.1", "2.2.2.2"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, newReq(ip))
		if rec.Code != http.StatusOK {
			t.Fatalf("first request for %s should pass, got %d", ip, rec.Code)
		}
	}
}

func TestRateLimiter_OnlyLimitsMatchingPath(t *testing.T) {
	rl := NewRateLimiter(0, 1, time.Minute)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	h := rl.LimitPath(http.MethodPost, "/dashboard/v1/auth/login")(next)

	// A GET to a different path is never throttled, even in a tight loop.
	for i := 0; i < 10; i++ {
		rec := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/dashboard/v1/payments", nil)
		r.RemoteAddr = "9.9.9.9:555"
		h.ServeHTTP(rec, r)
		if rec.Code != http.StatusOK {
			t.Fatalf("unrelated path should never be limited, got %d on iteration %d", rec.Code, i)
		}
	}
}
