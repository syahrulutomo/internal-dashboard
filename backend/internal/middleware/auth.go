package middleware

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/golang-jwt/jwt/v5"
)

// NewJWTAuthenticator returns an openapi3filter.AuthenticationFunc that enforces
// the `bearerAuth` security scheme declared in the OpenAPI spec. It is invoked
// by the request-validation middleware only for routes that require security,
// so public routes (such as login) are left untouched.
//
// A returned error is surfaced by the middleware as an HTTP 401, matching the
// `UnauthorizedError` response contract in the spec.
func NewJWTAuthenticator(secret []byte) openapi3filter.AuthenticationFunc {
	return func(_ context.Context, input *openapi3filter.AuthenticationInput) error {
		// Only handle the bearer scheme; anything else is unexpected for this API.
		if input.SecuritySchemeName != "bearerAuth" {
			return fmt.Errorf("unsupported security scheme %q", input.SecuritySchemeName)
		}

		authHeader := input.RequestValidationInput.Request.Header.Get("Authorization")
		if _, err := parseBearerToken(secret, authHeader); err != nil {
			return err
		}
		return nil
	}
}

// parseBearerToken parses and validates the JWT from an `Authorization: Bearer
// <token>` header value, returning its claims. It is the single place token
// validation rules live, so the request validator's AuthenticationFunc and the
// WithClaims middleware accept exactly the same tokens.
func parseBearerToken(secret []byte, authHeader string) (jwt.MapClaims, error) {
	if authHeader == "" {
		return nil, errors.New("missing authorization header")
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
		return nil, errors.New("authorization header must be a bearer token")
	}

	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(parts[1], claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return secret, nil
	},
		// Defence in depth: only accept the algorithm we actually sign with
		// (blocks the classic "alg": "none" / algorithm-confusion attacks)
		// and reject tokens that carry no expiry.
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
