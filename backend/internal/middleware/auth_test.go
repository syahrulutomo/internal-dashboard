package middleware

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/golang-jwt/jwt/v5"
)

var testSecret = []byte("test-secret")

// authInput builds the openapi3filter.AuthenticationInput the authenticator
// receives, wiring the given scheme name and Authorization header onto a
// minimal request.
func authInput(t *testing.T, scheme, authHeader string) *openapi3filter.AuthenticationInput {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, "/dashboard/v1/payments", nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	return &openapi3filter.AuthenticationInput{
		SecuritySchemeName: scheme,
		RequestValidationInput: &openapi3filter.RequestValidationInput{
			Request: req,
		},
	}
}

// signToken signs claims with HS256 and the test secret unless overridden.
func signToken(t *testing.T, claims jwt.Claims, method jwt.SigningMethod, key any) string {
	t.Helper()
	if method == nil {
		method = jwt.SigningMethodHS256
	}
	if key == nil {
		key = testSecret
	}
	tok := jwt.NewWithClaims(method, claims)
	signed, err := tok.SignedString(key)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func TestJWTAuthenticator_ValidToken(t *testing.T) {
	auth := NewJWTAuthenticator(testSecret)
	token := signToken(t, jwt.RegisteredClaims{
		Subject:   "1",
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}, nil, nil)

	if err := auth(context.Background(), authInput(t, "bearerAuth", "Bearer "+token)); err != nil {
		t.Fatalf("expected valid token to pass, got: %v", err)
	}
}

func TestJWTAuthenticator_BearerSchemeCaseInsensitive(t *testing.T) {
	auth := NewJWTAuthenticator(testSecret)
	token := signToken(t, jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}, nil, nil)

	// RFC 7235 makes the auth scheme case-insensitive; "bearer" must be accepted.
	if err := auth(context.Background(), authInput(t, "bearerAuth", "bearer "+token)); err != nil {
		t.Fatalf("expected lowercase bearer to pass, got: %v", err)
	}
}

func TestJWTAuthenticator_Rejects(t *testing.T) {
	auth := NewJWTAuthenticator(testSecret)

	validClaims := jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}

	cases := []struct {
		name   string
		scheme string
		header string
	}{
		{
			name:   "unsupported scheme",
			scheme: "apiKey",
			header: "Bearer " + signToken(t, validClaims, nil, nil),
		},
		{
			name:   "missing authorization header",
			scheme: "bearerAuth",
			header: "",
		},
		{
			name:   "header without bearer prefix",
			scheme: "bearerAuth",
			header: signToken(t, validClaims, nil, nil),
		},
		{
			name:   "wrong auth scheme",
			scheme: "bearerAuth",
			header: "Basic " + signToken(t, validClaims, nil, nil),
		},
		{
			name:   "bearer with empty token",
			scheme: "bearerAuth",
			header: "Bearer ",
		},
		{
			name:   "malformed token",
			scheme: "bearerAuth",
			header: "Bearer not.a.jwt",
		},
		{
			name:   "token signed with wrong secret",
			scheme: "bearerAuth",
			header: "Bearer " + signToken(t, validClaims, nil, []byte("other-secret")),
		},
		{
			name:   "expired token",
			scheme: "bearerAuth",
			header: "Bearer " + signToken(t, jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Hour))}, nil, nil),
		},
		{
			name:   "token without expiry",
			scheme: "bearerAuth",
			header: "Bearer " + signToken(t, jwt.RegisteredClaims{Subject: "1"}, nil, nil),
		},
		{
			// alg "none" / algorithm-confusion attack: a token asking for no
			// signature must be refused by the valid-methods guard.
			name:   "alg none token",
			scheme: "bearerAuth",
			header: "Bearer " + signToken(t, validClaims, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := auth(context.Background(), authInput(t, tc.scheme, tc.header))
			if err == nil {
				t.Fatalf("expected rejection for %q, got nil", tc.name)
			}
		})
	}
}
