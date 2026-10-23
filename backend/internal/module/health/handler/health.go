package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
	"github.com/durianpay/fullstack-boilerplate/internal/openapigen"
	"github.com/durianpay/fullstack-boilerplate/internal/transport"
)

type HealthHandler struct{}

func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

// GetHealth handles GET /health. It is a public liveness probe that reports
// the service is up, without touching any downstream dependency.
func (h *HealthHandler) GetHealth(w http.ResponseWriter, r *http.Request) {
	resp := openapigen.Health{
		Status: "ok",
		Time:   time.Now().UTC(),
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		transport.WriteAppError(w, entity.ErrorInternal("failed to encode response"))
	}
}
