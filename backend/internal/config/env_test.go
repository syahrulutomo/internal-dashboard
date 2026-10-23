package config

import (
	"os"
	"strings"
	"testing"
)

func TestGetEnv(t *testing.T) {
	const key = "DP_TEST_ENV_VAR"

	t.Run("returns the value when set", func(t *testing.T) {
		t.Setenv(key, "from-env")
		if got := getEnv(key, "fallback"); got != "from-env" {
			t.Errorf("getEnv = %q, want %q", got, "from-env")
		}
	})

	t.Run("falls back when unset", func(t *testing.T) {
		os.Unsetenv(key)
		if got := getEnv(key, "fallback"); got != "fallback" {
			t.Errorf("getEnv = %q, want fallback", got)
		}
	})

	t.Run("falls back when empty (empty is treated as unset)", func(t *testing.T) {
		t.Setenv(key, "")
		if got := getEnv(key, "fallback"); got != "fallback" {
			t.Errorf("getEnv = %q, want fallback", got)
		}
	})
}

func TestIsProduction(t *testing.T) {
	saved := Env
	t.Cleanup(func() { Env = saved })

	cases := map[string]bool{
		"production":  true,
		"prod":        true,
		"development": false,
		"staging":     false,
		"":            false,
	}
	for env, want := range cases {
		Env = env
		if got := IsProduction(); got != want {
			t.Errorf("IsProduction() with Env=%q = %v, want %v", env, got, want)
		}
	}
}

func TestValidate(t *testing.T) {
	// Validate reads package-level config; snapshot and restore around the table
	// so cases don't leak into each other or the rest of the suite.
	savedEnv, savedSecret, savedCORS := Env, JwtSecret, CORSAllowedOrigins
	t.Cleanup(func() {
		Env, JwtSecret, CORSAllowedOrigins = savedEnv, savedSecret, savedCORS
	})

	strongSecret := []byte(strings.Repeat("x", 32))

	cases := []struct {
		name    string
		env     string
		secret  []byte
		cors    string
		wantErr string // substring; "" means no error expected
	}{
		{
			name:    "development skips all checks even with the dev default and wildcard CORS",
			env:     "development",
			secret:  []byte(insecureDefaultSecret),
			cors:    "*",
			wantErr: "",
		},
		{
			name:    "production rejects the insecure dev default secret",
			env:     "production",
			secret:  []byte(insecureDefaultSecret),
			cors:    "https://app.durianpay.id",
			wantErr: "JWT_SECRET",
		},
		{
			name:    "production rejects an empty secret",
			env:     "production",
			secret:  []byte(""),
			cors:    "https://app.durianpay.id",
			wantErr: "JWT_SECRET",
		},
		{
			name:    "production rejects a secret shorter than 32 bytes",
			env:     "production",
			secret:  []byte("too-short"),
			cors:    "https://app.durianpay.id",
			wantErr: "at least 32 bytes",
		},
		{
			name:    "production rejects wildcard CORS",
			env:     "production",
			secret:  strongSecret,
			cors:    "*",
			wantErr: "CORS_ALLOWED_ORIGINS",
		},
		{
			name:    "production passes with a strong secret and a concrete origin",
			env:     "prod",
			secret:  strongSecret,
			cors:    "https://app.durianpay.id",
			wantErr: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			Env, JwtSecret, CORSAllowedOrigins = tc.env, tc.secret, tc.cors
			err := Validate()
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("Validate() = %v, want nil", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("Validate() = nil, want error containing %q", tc.wantErr)
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Errorf("Validate() error = %q, want substring %q", err.Error(), tc.wantErr)
			}
		})
	}
}
