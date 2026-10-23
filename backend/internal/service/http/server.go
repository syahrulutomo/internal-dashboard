package http

import (
	"context"
	"encoding/json"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/durianpay/fullstack-boilerplate/internal/config"
	mw "github.com/durianpay/fullstack-boilerplate/internal/middleware"
	"github.com/durianpay/fullstack-boilerplate/internal/openapigen"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/go-chi/chi/v5"
	oapinethttpmw "github.com/oapi-codegen/nethttp-middleware"
)

type Server struct {
	router http.Handler
	logger *slog.Logger
}

const (
	readTimeout  = 10
	writeTimeout = 10
	idleTimeout  = 60

	// loginPath is rate-limited to blunt credential brute-forcing.
	loginPath = "/dashboard/v1/auth/login"
	// loginRate/loginBurst: ~sustained 1 req/5s per IP, bursting to 5.
	loginRate  = 0.2
	loginBurst = 5
)

// ReadinessFunc reports whether the service's dependencies (e.g. the database)
// are reachable. A nil error means ready.
type ReadinessFunc func(ctx context.Context) error

// NewServer assembles the HTTP router. The logger is used for structured access
// logs, and ready (optional) backs the /readyz probe so orchestrators can tell
// liveness (/health) from readiness-to-serve.
func NewServer(apiHandler openapigen.ServerInterface, openapiYamlPath string, logger *slog.Logger, ready ReadinessFunc) *Server {
	if logger == nil {
		logger = slog.Default()
	}

	swagger, err := openapigen.GetSwagger()
	if err != nil {
		log.Fatalf("failed to load swagger: %v", err)
	}

	loginLimiter := mw.NewRateLimiter(loginRate, loginBurst, 10*time.Minute)

	r := chi.NewRouter()

	// Correlation id first so every downstream log line can be grouped, then the
	// access log so it times the whole request.
	r.Use(mw.RequestID)
	r.Use(mw.AccessLog(logger))
	// CORS runs before the OpenAPI validator so that preflight OPTIONS requests
	// are answered before the validator (which has no OPTIONS route) can reject
	// them.
	r.Use(mw.CORS(config.CORSAllowedOrigins))

	// Documentation + ops routes are registered outside the validated group:
	// they are not part of the OpenAPI spec, so the request validator would
	// otherwise reject them.
	r.Get("/openapi.yaml", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/yaml")
		http.ServeFile(w, req, openapiYamlPath)
	})
	r.Get("/docs", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(swaggerUIHTML))
	})
	// Readiness probe: returns 503 until the database is reachable, so a load
	// balancer only routes traffic once the instance can actually serve it.
	r.Get("/ready", func(w http.ResponseWriter, req *http.Request) {
		if ready != nil {
			ctx, cancel := context.WithTimeout(req.Context(), 2*time.Second)
			defer cancel()
			if err := ready(ctx); err != nil {
				jsonErrorHandler(w, "not ready: "+err.Error(), http.StatusServiceUnavailable)
				return
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	})

	r.Group(func(api chi.Router) {
		// Throttle login attempts per client IP before validation/auth runs.
		api.Use(loginLimiter.LimitPath(http.MethodPost, loginPath))
		api.Use(oapinethttpmw.OapiRequestValidatorWithOptions(
			swagger,
			&oapinethttpmw.Options{
				DoNotValidateServers:  true,
				SilenceServersWarning: true,
				// Enforce the `bearerAuth` security scheme using JWT validation.
				Options: openapi3filter.Options{
					AuthenticationFunc: mw.NewJWTAuthenticator(config.JwtSecret),
				},
				// Return spec-shaped JSON ({code, message}) for validation and
				// auth failures instead of the default plain-text body.
				ErrorHandler: jsonErrorHandler,
			},
		))
		// After the validator has authenticated the request, parse the verified
		// bearer token once more to expose the caller's claims (role) to handlers
		// via the request context, so they can authorize role-restricted actions
		// (e.g. payments export). See mw.WithClaims for why this re-parse is
		// deliberate.
		api.Use(mw.WithClaims(config.JwtSecret))
		openapigen.HandlerFromMux(apiHandler, api)
	})

	return &Server{
		router: r,
		logger: logger,
	}
}

// swaggerUIHTML renders Swagger UI (loaded from a CDN) pointed at /openapi.yaml.
const swaggerUIHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/openapi.yaml',
      dom_id: '#swagger-ui',
    });
  </script>
</body>
</html>`

// jsonErrorHandler writes validation/authentication errors as JSON matching the
// OpenAPI `Error` schema.
func jsonErrorHandler(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"code":    statusCode,
		"message": message,
	})
}

func (s *Server) Start(addr string) {
	service := &http.Server{
		Addr:         addr,
		Handler:      s.router,
		ReadTimeout:  readTimeout * time.Second,
		WriteTimeout: writeTimeout * time.Second,
		IdleTimeout:  idleTimeout * time.Second,
	}
	go func() {
		s.logger.Info("listening", slog.String("addr", addr))
		if err := service.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Error("server error", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	<-stop
	s.logger.Info("shutting down gracefully")

	// Timeout for shutdown
	const shutdownTimeout = 10 * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := service.Shutdown(ctx); err != nil {
		s.logger.Error("forced shutdown", slog.String("error", err.Error()))
		os.Exit(1)
	}

	s.logger.Info("server stopped cleanly")
}

func (s *Server) Routes() http.Handler {
	return s.router
}
