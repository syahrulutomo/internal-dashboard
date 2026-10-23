package middleware

import (
	"context"
	"net/http"
)

// Claims carries the authenticated caller's identity, extracted from a verified
// JWT. Handlers read it from the request context (ClaimsFromContext) to make
// authorization decisions — e.g. restricting payment export to the operation
// role.
type Claims struct {
	UserID string
	Email  string
	Role   string
}

type claimsKey struct{}

// WithClaims parses the bearer token (when present) and stashes the verified
// claims on the request context so downstream handlers can authorize by role.
//
// It deliberately re-parses the token rather than reusing the request
// validator's AuthenticationFunc result: kin-openapi's nethttp middleware calls
// the next handler with the original request, so a context value set inside the
// AuthenticationFunc never reaches the handler. parseBearerToken is the single
// shared validator, so both paths accept exactly the same tokens; the extra
// parse is a negligible cost for a much clearer data flow.
//
// A missing or invalid token is a no-op here (no claims added), NOT an error:
// the OpenAPI validator already rejects unauthenticated requests to protected
// routes with a 401, and public routes (login) legitimately carry no token. A
// handler that requires a role simply finds no claims and denies the action.
func WithClaims(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, err := parseBearerToken(secret, r.Header.Get("Authorization"))
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			c := Claims{
				UserID: claimString(claims, "sub"),
				Email:  claimString(claims, "email"),
				Role:   claimString(claims, "role"),
			}
			ctx := context.WithValue(r.Context(), claimsKey{}, c)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ClaimsFromContext returns the authenticated caller's claims and whether they
// were present. Absent claims (ok == false) mean the request carried no valid
// bearer token.
func ClaimsFromContext(ctx context.Context) (Claims, bool) {
	c, ok := ctx.Value(claimsKey{}).(Claims)
	return c, ok
}

// claimString reads a string claim defensively — jwt.MapClaims values are
// `any`, so a missing key or non-string value yields "" rather than a panic.
func claimString(claims map[string]any, key string) string {
	if v, ok := claims[key].(string); ok {
		return v
	}
	return ""
}
