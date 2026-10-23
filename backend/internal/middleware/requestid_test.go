package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequestID_ReusesIncomingHeader(t *testing.T) {
	var seen string
	h := RequestID(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		seen = RequestIDFromContext(r.Context())
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(RequestIDHeader, "trace-123")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if seen != "trace-123" {
		t.Errorf("context id = %q, want trace-123", seen)
	}
	if got := rec.Header().Get(RequestIDHeader); got != "trace-123" {
		t.Errorf("echoed header = %q, want trace-123", got)
	}
}

func TestRequestID_GeneratesWhenAbsent(t *testing.T) {
	var seen string
	h := RequestID(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		seen = RequestIDFromContext(r.Context())
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if seen == "" {
		t.Fatal("expected a generated request id on the context")
	}
	// The generated id is echoed back to the caller.
	if got := rec.Header().Get(RequestIDHeader); got != seen {
		t.Errorf("echoed header = %q, want %q", got, seen)
	}
}

func TestRequestIDFromContext_AbsentIsEmpty(t *testing.T) {
	if got := RequestIDFromContext(context.Background()); got != "" {
		t.Errorf("RequestIDFromContext(empty) = %q, want \"\"", got)
	}
}
