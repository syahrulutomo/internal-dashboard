package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// captureClaims runs WithClaims around a handler that records what it found on
// the context, and returns that plus whether claims were present. It reuses the
// package-level testSecret / signToken helpers from auth_test.go.
func captureClaims(t *testing.T, authHeader string) (Claims, bool) {
	t.Helper()
	var got Claims
	var ok bool
	h := WithClaims(testSecret)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		got, ok = ClaimsFromContext(r.Context())
	}))

	req := httptest.NewRequest(http.MethodGet, "/dashboard/v1/payments/export", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	h.ServeHTTP(httptest.NewRecorder(), req)
	return got, ok
}

func TestWithClaims_InjectsVerifiedClaims(t *testing.T) {
	token := signToken(t, jwt.MapClaims{
		"sub":   "42",
		"email": "operation@test.com",
		"role":  "operation",
		"exp":   time.Now().Add(time.Hour).Unix(),
	}, nil, nil)

	got, ok := captureClaims(t, "Bearer "+token)
	if !ok {
		t.Fatal("expected claims on context for a valid token")
	}
	if got.Role != "operation" || got.Email != "operation@test.com" || got.UserID != "42" {
		t.Errorf("unexpected claims: %+v", got)
	}
}

func TestWithClaims_MissingStringClaimsBecomeEmpty(t *testing.T) {
	// A valid token that omits sub/email still yields claims — the absent fields
	// default to "" rather than panicking (claimString reads defensively).
	token := signToken(t, jwt.MapClaims{
		"role": "cs",
		"exp":  time.Now().Add(time.Hour).Unix(),
	}, nil, nil)

	got, ok := captureClaims(t, "Bearer "+token)
	if !ok {
		t.Fatal("expected claims on context for a valid token")
	}
	if got.Role != "cs" {
		t.Errorf("Role = %q, want cs", got.Role)
	}
	if got.Email != "" || got.UserID != "" {
		t.Errorf("absent claims should be empty, got email=%q sub=%q", got.Email, got.UserID)
	}
}

func TestWithClaims_NoClaimsWhenTokenAbsentOrInvalid(t *testing.T) {
	validClaims := jwt.MapClaims{"role": "operation", "exp": time.Now().Add(time.Hour).Unix()}

	cases := map[string]string{
		"no header":       "",
		"not bearer":      "Basic abc",
		"garbage token":   "Bearer not.a.jwt",
		"wrong signature": "Bearer " + signToken(t, validClaims, nil, []byte("a-different-secret")),
		"expired token":   "Bearer " + signToken(t, jwt.MapClaims{"role": "operation", "exp": time.Now().Add(-time.Hour).Unix()}, nil, nil),
		"missing expiry":  "Bearer " + signToken(t, jwt.MapClaims{"role": "operation"}, nil, nil),
	}
	for name, header := range cases {
		t.Run(name, func(t *testing.T) {
			// Missing/invalid tokens are a no-op: no claims, but the request still
			// proceeds (the validator, not this middleware, returns the 401).
			if _, ok := captureClaims(t, header); ok {
				t.Errorf("expected no claims for %q", name)
			}
		})
	}
}
