package api

import (
	"net/http"

	ah "github.com/durianpay/fullstack-boilerplate/internal/module/auth/handler"
	hh "github.com/durianpay/fullstack-boilerplate/internal/module/health/handler"
	ph "github.com/durianpay/fullstack-boilerplate/internal/module/payment/handler"
	"github.com/durianpay/fullstack-boilerplate/internal/openapigen"
)

type APIHandler struct {
	Auth    *ah.AuthHandler
	Payment *ph.PaymentHandler
	Health  *hh.HealthHandler
}

var _ openapigen.ServerInterface = (*APIHandler)(nil)

func (h *APIHandler) GetHealth(w http.ResponseWriter, r *http.Request) {
	h.Health.GetHealth(w, r)
}

func (h *APIHandler) PostDashboardV1AuthLogin(w http.ResponseWriter, r *http.Request) {
	h.Auth.PostDashboardV1AuthLogin(w, r)
}

func (h *APIHandler) GetDashboardV1AuthMe(w http.ResponseWriter, r *http.Request) {
	h.Auth.GetDashboardV1AuthMe(w, r)
}

func (h *APIHandler) GetDashboardV1Payments(w http.ResponseWriter, r *http.Request, params openapigen.GetDashboardV1PaymentsParams) {
	h.Payment.GetDashboardV1Payments(w, r, params)
}

func (h *APIHandler) GetDashboardV1PaymentsExport(w http.ResponseWriter, r *http.Request, params openapigen.GetDashboardV1PaymentsExportParams) {
	h.Payment.GetDashboardV1PaymentsExport(w, r, params)
}

func (h *APIHandler) GetDashboardV1PaymentsSummary(w http.ResponseWriter, r *http.Request) {
	h.Payment.GetDashboardV1PaymentsSummary(w, r)
}
