package config

import (
	"errors"
	"os"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/mattn/go-sqlite3"
)

// insecureDefaultSecret is the placeholder JWT secret used for local
// development. It must never be used in production — Validate rejects it.
const insecureDefaultSecret = "dev-secret-replace-me"

var (
	// Env is the deployment environment ("development" | "production"). It
	// gates fail-fast checks: in production a weak/default secret is fatal.
	Env         = getEnv("APP_ENV", "development")
	JwtSecret   = []byte(getEnv("JWT_SECRET", insecureDefaultSecret))
	JwtExpired  = getEnv("JWT_EXPIRED", "24h")
	HttpAddress = getEnv("HTTP_ADDR", ":8080")
	// DBPath is the SQLite database file location. Override it (e.g. to a
	// mounted volume path) so data survives container restarts.
	DBPath              = getEnv("DB_PATH", "dashboard.db")
	OpenapiYamlLocation = getEnv("OPENAPIYAML_LOCATION", "../openapi.yaml")
	// CORSAllowedOrigins is a comma-separated allow-list of browser origins.
	// Defaults to the local Next.js dev/prod server; set "*" to allow any.
	CORSAllowedOrigins = getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
)

// IsProduction reports whether the service is running in production mode.
func IsProduction() bool {
	return Env == "production" || Env == "prod"
}

// Validate checks that the configuration is safe to run with and returns an
// error describing the first problem found. Callers should treat a non-nil
// result as fatal and refuse to start — failing loud at boot is far safer than
// silently serving with an insecure or misconfigured setup.
func Validate() error {
	if IsProduction() {
		if len(JwtSecret) == 0 || string(JwtSecret) == insecureDefaultSecret {
			return errors.New("JWT_SECRET must be set to a strong value in production (the dev default is not allowed)")
		}
		if len(JwtSecret) < 32 {
			return errors.New("JWT_SECRET must be at least 32 bytes in production")
		}
		if CORSAllowedOrigins == "*" {
			return errors.New("CORS_ALLOWED_ORIGINS must not be '*' in production")
		}
	}
	return nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
