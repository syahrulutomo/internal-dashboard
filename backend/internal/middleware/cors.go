package middleware

import (
	"net/http"
	"strings"
)

// CORS returns middleware that allows the browser-based frontend to call the
// API cross-origin. It must run before the OpenAPI request-validation
// middleware so that preflight OPTIONS requests are short-circuited with a 204
// before validation (which has no OPTIONS route) can reject them.
//
// allowedOrigins is a comma-separated list; "*" allows any origin.
func CORS(allowedOrigins string) func(http.Handler) http.Handler {
	origins := parseOrigins(allowedOrigins)
	allowAll := origins["*"]

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && (allowAll || origins[origin]) {
				if allowAll {
					w.Header().Set("Access-Control-Allow-Origin", "*")
				} else {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Add("Vary", "Origin")
				}
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Max-Age", "86400")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func parseOrigins(s string) map[string]bool {
	out := make(map[string]bool)
	for _, o := range strings.Split(s, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			out[o] = true
		}
	}
	return out
}
