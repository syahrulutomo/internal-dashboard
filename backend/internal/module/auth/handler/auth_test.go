package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	mw "github.com/durianpay/fullstack-boilerplate/internal/middleware"
	"github.com/golang-jwt/jwt/v5"
)

var meSecret = []byte("test-secret")

func signMeToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString(meSecret)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

// serveMe runs GetDashboardV1AuthMe behind the WithClaims middleware, exactly as
// the real server wires it, so the handler sees claims only when a valid bearer
// token is present.
func serveMe(authHeader string) *httptest.ResponseRecorder {
	h := mw.WithClaims(meSecret)(http.HandlerFunc((&AuthHandler{}).GetDashboardV1AuthMe))
	req := httptest.NewRequest(http.MethodGet, "/dashboard/v1/auth/me", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestGetMe_ReturnsIdentityFromClaims(t *testing.T) {
	token := signMeToken(t, jwt.MapClaims{
		"sub":   "7",
		"email": "operation@test.com",
		"role":  "operation",
		"exp":   time.Now().Add(time.Hour).Unix(),
	})

	rec := serveMe("Bearer " + token)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body["email"] != "operation@test.com" || body["role"] != "operation" {
		t.Errorf("unexpected body: %v", body)
	}
	// /me must never echo a credential back.
	if _, ok := body["token"]; ok {
		t.Errorf("response unexpectedly contains a token field: %v", body)
	}
}

func TestGetMe_UnauthorizedWhenClaimsAbsent(t *testing.T) {
	// No valid bearer token → WithClaims adds nothing → handler fails closed.
	rec := serveMe("")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 (body: %s)", rec.Code, rec.Body.String())
	}
}
