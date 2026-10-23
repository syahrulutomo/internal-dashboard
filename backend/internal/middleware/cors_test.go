package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// nextOK is a terminal handler that records whether it ran and writes 200.
func nextOK(ran *bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		*ran = true
		w.WriteHeader(http.StatusOK)
	})
}

func TestCORS_AllowedOriginGetsHeaders(t *testing.T) {
	var ran bool
	h := CORS("http://localhost:3000")(nextOK(&ran))

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if !ran {
		t.Error("next handler should run for a normal GET")
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Errorf("Allow-Origin = %q, want the specific origin echoed", got)
	}
	if got := rec.Header().Get("Vary"); got != "Origin" {
		t.Errorf("Vary = %q, want Origin", got)
	}
	if rec.Header().Get("Access-Control-Allow-Headers") == "" {
		t.Error("Allow-Headers not set")
	}
}

func TestCORS_WildcardAllowsAnyOrigin(t *testing.T) {
	var ran bool
	h := CORS("*")(nextOK(&ran))

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("Allow-Origin = %q, want *", got)
	}
	// Wildcard mode does not vary on Origin.
	if got := rec.Header().Get("Vary"); got != "" {
		t.Errorf("Vary = %q, want empty under wildcard", got)
	}
}

func TestCORS_DisallowedOriginGetsNoHeaders(t *testing.T) {
	var ran bool
	h := CORS("http://localhost:3000")(nextOK(&ran))

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if !ran {
		t.Error("next handler should still run (CORS does not block the request itself)")
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Allow-Origin = %q, want empty for a disallowed origin", got)
	}
}

// The load-bearing behavior: an OPTIONS preflight must be short-circuited with a
// 204 before the (OPTIONS-less) OpenAPI validator can see it, and the next
// handler must NOT run.
func TestCORS_PreflightShortCircuits(t *testing.T) {
	var ran bool
	h := CORS("http://localhost:3000")(nextOK(&ran))

	req := httptest.NewRequest(http.MethodOptions, "/x", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if ran {
		t.Error("next handler must not run for a preflight OPTIONS")
	}
	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Errorf("preflight should carry CORS headers, got Allow-Origin %q", got)
	}
}

func TestCORS_NoOriginHeaderIsPassthrough(t *testing.T) {
	var ran bool
	h := CORS("http://localhost:3000")(nextOK(&ran))

	req := httptest.NewRequest(http.MethodGet, "/x", nil) // no Origin
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if !ran {
		t.Error("next handler should run for a same-origin request")
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Allow-Origin = %q, want empty when no Origin header", got)
	}
}
