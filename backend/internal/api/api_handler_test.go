package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
	ah "github.com/durianpay/fullstack-boilerplate/internal/module/auth/handler"
	hh "github.com/durianpay/fullstack-boilerplate/internal/module/health/handler"
	ph "github.com/durianpay/fullstack-boilerplate/internal/module/payment/handler"
	"github.com/durianpay/fullstack-boilerplate/internal/openapigen"
)

// fakePaymentUC records which methods were invoked so delegation can be asserted.
type fakePaymentUC struct {
	list, export, summary bool
}

func (f *fakePaymentUC) ListPayments(context.Context, entity.PaymentFilter) (entity.PaymentPage, error) {
	f.list = true
	return entity.PaymentPage{Page: 1, PerPage: 20}, nil
}
func (f *fakePaymentUC) ExportPayments(context.Context, entity.PaymentFilter, string) (entity.PaymentPage, error) {
	f.export = true
	return entity.PaymentPage{Page: 1, PerPage: 500}, nil
}
func (f *fakePaymentUC) GetSummary(context.Context) (entity.PaymentSummary, error) {
	f.summary = true
	return entity.PaymentSummary{AmountCentsByStatus: map[entity.PaymentStatus]int64{}}, nil
}

// fakeAuthUC records a Login call and returns a canned token/user.
type fakeAuthUC struct{ login bool }

func (f *fakeAuthUC) Login(context.Context, string, string) (string, *entity.User, error) {
	f.login = true
	return "tok", &entity.User{Email: "cs@test.com", Role: entity.RoleCS}, nil
}

func newAPI() (*APIHandler, *fakePaymentUC, *fakeAuthUC) {
	payUC := &fakePaymentUC{}
	authUC := &fakeAuthUC{}
	return &APIHandler{
		Auth:    ah.NewAuthHandler(authUC),
		Payment: ph.NewPaymentHandler(payUC),
		Health:  hh.NewHealthHandler(),
	}, payUC, authUC
}

func TestAPIHandler_DelegatesHealth(t *testing.T) {
	h, _, _ := newAPI()
	rec := httptest.NewRecorder()
	h.GetHealth(rec, httptest.NewRequest(http.MethodGet, "/health", nil))
	if rec.Code != http.StatusOK {
		t.Errorf("GetHealth status = %d, want 200", rec.Code)
	}
}

func TestAPIHandler_DelegatesPayments(t *testing.T) {
	h, pay, _ := newAPI()

	h.GetDashboardV1Payments(httptest.NewRecorder(),
		httptest.NewRequest(http.MethodGet, "/dashboard/v1/payments", nil),
		openapigen.GetDashboardV1PaymentsParams{})
	if !pay.list {
		t.Error("GetDashboardV1Payments did not delegate to Payment.ListPayments")
	}

	h.GetDashboardV1PaymentsExport(httptest.NewRecorder(),
		httptest.NewRequest(http.MethodGet, "/dashboard/v1/payments/export", nil),
		openapigen.GetDashboardV1PaymentsExportParams{})
	if !pay.export {
		t.Error("GetDashboardV1PaymentsExport did not delegate to Payment.ExportPayments")
	}

	h.GetDashboardV1PaymentsSummary(httptest.NewRecorder(),
		httptest.NewRequest(http.MethodGet, "/dashboard/v1/payments/summary", nil))
	if !pay.summary {
		t.Error("GetDashboardV1PaymentsSummary did not delegate to Payment.GetSummary")
	}
}

func TestAPIHandler_DelegatesAuthLogin(t *testing.T) {
	h, _, auth := newAPI()
	body := strings.NewReader(`{"email":"cs@test.com","password":"password"}`)
	rec := httptest.NewRecorder()
	h.PostDashboardV1AuthLogin(rec, httptest.NewRequest(http.MethodPost, "/dashboard/v1/auth/login", body))
	if !auth.login {
		t.Error("PostDashboardV1AuthLogin did not delegate to Auth.Login")
	}
	if rec.Code != http.StatusOK {
		t.Errorf("login status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
}

func TestAPIHandler_DelegatesAuthMe(t *testing.T) {
	h, _, _ := newAPI()
	// No claims on the context → the Me handler fails closed with 401, which
	// proves the call reached the auth handler.
	rec := httptest.NewRecorder()
	h.GetDashboardV1AuthMe(rec, httptest.NewRequest(http.MethodGet, "/dashboard/v1/auth/me", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("me status = %d, want 401", rec.Code)
	}
}
