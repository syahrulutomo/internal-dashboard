package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

// RequestIDHeader is the HTTP header used to carry a correlation id in and out
// of the service.
const RequestIDHeader = "X-Request-ID"

type ctxKey int

const requestIDKey ctxKey = iota

// RequestID attaches a correlation id to every request: it reuses an incoming
// X-Request-ID when present (so a trace can span services) or generates one,
// stores it on the request context, and echoes it back on the response. The id
// lets logs for a single request be grouped across the stack.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(RequestIDHeader)
		if id == "" {
			id = uuid.NewString()
		}
		w.Header().Set(RequestIDHeader, id)
		ctx := context.WithValue(r.Context(), requestIDKey, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequestIDFromContext returns the correlation id for the request, or "" if the
// RequestID middleware did not run.
func RequestIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDKey).(string); ok {
		return id
	}
	return ""
}
