package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientIP(t *testing.T) {
	cases := []struct {
		name       string
		xff        string
		remoteAddr string
		want       string
	}{
		{"x-forwarded-for takes the left-most entry", "1.2.3.4, 5.6.7.8", "10.0.0.1:9999", "1.2.3.4"},
		{"x-forwarded-for single entry is trimmed", "  9.9.9.9  ", "10.0.0.1:9999", "9.9.9.9"},
		{"falls back to RemoteAddr host when no XFF", "", "203.0.113.5:4567", "203.0.113.5"},
		{"RemoteAddr without a port is returned as-is", "", "unix-socket", "unix-socket"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.RemoteAddr = tc.remoteAddr
			if tc.xff != "" {
				req.Header.Set("X-Forwarded-For", tc.xff)
			}
			if got := clientIP(req); got != tc.want {
				t.Errorf("clientIP() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestMinFloat(t *testing.T) {
	cases := []struct{ a, b, want float64 }{
		{1, 2, 1},
		{2, 1, 1},
		{3, 3, 3},
		{-1, 0, -1},
	}
	for _, tc := range cases {
		if got := minFloat(tc.a, tc.b); got != tc.want {
			t.Errorf("minFloat(%v, %v) = %v, want %v", tc.a, tc.b, got, tc.want)
		}
	}
}
