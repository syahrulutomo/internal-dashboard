package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
	mw "github.com/durianpay/fullstack-boilerplate/internal/middleware"
	paymentUsecase "github.com/durianpay/fullstack-boilerplate/internal/module/payment/usecase"
	"github.com/durianpay/fullstack-boilerplate/internal/openapigen"
	"github.com/durianpay/fullstack-boilerplate/internal/transport"
)

type PaymentHandler struct {
	paymentUC paymentUsecase.PaymentUsecase
}

func NewPaymentHandler(paymentUC paymentUsecase.PaymentUsecase) *PaymentHandler {
	return &PaymentHandler{paymentUC: paymentUC}
}

// GetDashboardV1Payments handles GET /dashboard/v1/payments with optional
// status, id and sort query parameters.
func (h *PaymentHandler) GetDashboardV1Payments(w http.ResponseWriter, r *http.Request, params openapigen.GetDashboardV1PaymentsParams) {
	filter := entity.PaymentFilter{}
	if params.Status != nil {
		filter.Status = *params.Status
	}
	if params.Id != nil {
		filter.ID = *params.Id
	}
	if params.Search != nil {
		filter.Search = strings.TrimSpace(*params.Search)
	}
	if params.Sort != nil {
		filter.Sort = *params.Sort
	}
	if params.Page != nil {
		filter.Page = *params.Page
	}
	if params.PerPage != nil {
		filter.PerPage = *params.PerPage
	}

	page, err := h.paymentUC.ListPayments(r.Context(), filter)
	if err != nil {
		transport.WriteError(w, err)
		return
	}

	resp := openapigen.PaymentListResponse{
		Payments: toAPIPayments(page.Items),
		Meta: &openapigen.PaginationMeta{
			Page:       page.Page,
			PerPage:    page.PerPage,
			Total:      page.Total,
			TotalPages: page.TotalPages,
		},
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		transport.WriteAppError(w, entity.ErrorInternal("failed to encode response"))
	}
}

// GetDashboardV1PaymentsExport handles GET /dashboard/v1/payments/export. It is
// the role-restricted export of the payments list: the caller's role (from the
// verified JWT, injected by the WithClaims middleware) is handed to the usecase,
// which denies any non-operation role with a 403. The response shape mirrors the
// list endpoint, but holds the full matching set in one page.
func (h *PaymentHandler) GetDashboardV1PaymentsExport(w http.ResponseWriter, r *http.Request, params openapigen.GetDashboardV1PaymentsExportParams) {
	filter := entity.PaymentFilter{}
	if params.Status != nil {
		filter.Status = *params.Status
	}

	// Absent claims yield an empty role, which the usecase treats as forbidden —
	// authorization fails closed.
	claims, _ := mw.ClaimsFromContext(r.Context())

	page, err := h.paymentUC.ExportPayments(r.Context(), filter, claims.Role)
	if err != nil {
		transport.WriteError(w, err)
		return
	}

	resp := openapigen.PaymentListResponse{
		Payments: toAPIPayments(page.Items),
		Meta: &openapigen.PaginationMeta{
			Page:       page.Page,
			PerPage:    page.PerPage,
			Total:      page.Total,
			TotalPages: page.TotalPages,
		},
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		transport.WriteAppError(w, entity.ErrorInternal("failed to encode response"))
	}
}

// GetDashboardV1PaymentsSummary handles GET /dashboard/v1/payments/summary,
// returning aggregate counts and volume across all payments for the dashboard
// summary widget.
func (h *PaymentHandler) GetDashboardV1PaymentsSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.paymentUC.GetSummary(r.Context())
	if err != nil {
		transport.WriteError(w, err)
		return
	}

	resp := openapigen.Summary{
		Total:       summary.Total,
		Completed:   summary.Completed,
		Processing:  summary.Processing,
		Failed:      summary.Failed,
		TotalAmount: formatAmount(summary.TotalAmountCents),
	}
	resp.AmountByStatus.Completed = formatAmount(summary.AmountCentsByStatus[entity.PaymentStatusCompleted])
	resp.AmountByStatus.Processing = formatAmount(summary.AmountCentsByStatus[entity.PaymentStatusProcessing])
	resp.AmountByStatus.Failed = formatAmount(summary.AmountCentsByStatus[entity.PaymentStatusFailed])

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		transport.WriteAppError(w, entity.ErrorInternal("failed to encode response"))
	}
}

func toAPIPayments(payments []entity.Payment) *[]openapigen.Payment {
	out := make([]openapigen.Payment, 0, len(payments))
	for _, p := range payments {
		p := p
		id := p.ID
		merchant := p.Merchant
		status := string(p.Status)
		amount := formatAmount(p.AmountCents)
		createdAt := p.CreatedAt
		out = append(out, openapigen.Payment{
			Id:        &id,
			Merchant:  &merchant,
			Status:    &status,
			Amount:    &amount,
			CreatedAt: &createdAt,
		})
	}
	return &out
}

// formatAmount converts an integer number of cents into a fixed 2-decimal
// string, e.g. 198200 -> "1982.00".
func formatAmount(cents int64) string {
	neg := ""
	if cents < 0 {
		neg = "-"
		cents = -cents
	}
	return fmt.Sprintf("%s%d.%02d", neg, cents/100, cents%100)
}
