package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
	mw "github.com/durianpay/fullstack-boilerplate/internal/middleware"
	"github.com/durianpay/fullstack-boilerplate/internal/openapigen"
	"github.com/golang-jwt/jwt/v5"
)

// fakePaymentUsecase is a hand-written stand-in for paymentUsecase.PaymentUsecase.
// It records the arguments each method received and returns canned values so the
// handler can be exercised without a usecase, repository or database.
type fakePaymentUsecase struct {
	// recorded inputs
	listFilter    entity.PaymentFilter
	exportFilter  entity.PaymentFilter
	exportRole    string
	summaryCalled bool

	// canned outputs
	listPage   entity.PaymentPage
	listErr    error
	exportPage entity.PaymentPage
	exportErr  error
	summary    entity.PaymentSummary
	summaryErr error
}

func (f *fakePaymentUsecase) ListPayments(_ context.Context, filter entity.PaymentFilter) (entity.PaymentPage, error) {
	f.listFilter = filter
	return f.listPage, f.listErr
}

func (f *fakePaymentUsecase) ExportPayments(_ context.Context, filter entity.PaymentFilter, requesterRole string) (entity.PaymentPage, error) {
	f.exportFilter = filter
	f.exportRole = requesterRole
	return f.exportPage, f.exportErr
}

func (f *fakePaymentUsecase) GetSummary(_ context.Context) (entity.PaymentSummary, error) {
	f.summaryCalled = true
	return f.summary, f.summaryErr
}

func ptr[T any](v T) *T { return &v }

var testSecret = []byte("test-secret")

func signToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString(testSecret)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

// --- GetDashboardV1Payments ---------------------------------------------------

func TestGetPayments_MapsParamsAndTrimsSearch(t *testing.T) {
	uc := &fakePaymentUsecase{
		listPage: entity.PaymentPage{
			Items: []entity.Payment{{
				ID: "PAY-1001", Merchant: "Acme", Status: entity.PaymentStatusCompleted,
				AmountCents: 198200, Currency: "USD", CreatedAt: time.Unix(0, 0).UTC(),
			}},
			Total: 1, Page: 2, PerPage: 10, TotalPages: 1,
		},
	}
	h := NewPaymentHandler(uc)

	params := openapigen.GetDashboardV1PaymentsParams{
		Status:  ptr("completed"),
		Id:      ptr("PAY-1001"),
		Search:  ptr("  acme  "),
		Sort:    ptr("-created_at"),
		Page:    ptr(2),
		PerPage: ptr(10),
	}
	req := httptest.NewRequest(http.MethodGet, "/dashboard/v1/payments", nil)
	rec := httptest.NewRecorder()
	h.GetDashboardV1Payments(rec, req, params)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	// The one piece of mapping logic worth asserting: Search is trimmed.
	if uc.listFilter.Search != "acme" {
		t.Errorf("Search = %q, want %q (should be trimmed)", uc.listFilter.Search, "acme")
	}
	if uc.listFilter.Status != "completed" || uc.listFilter.ID != "PAY-1001" ||
		uc.listFilter.Sort != "-created_at" || uc.listFilter.Page != 2 || uc.listFilter.PerPage != 10 {
		t.Errorf("unexpected filter: %+v", uc.listFilter)
	}

	var body openapigen.PaymentListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Payments == nil || len(*body.Payments) != 1 {
		t.Fatalf("expected 1 payment, got %+v", body.Payments)
	}
	if got := *(*body.Payments)[0].Amount; got != "1982.00" {
		t.Errorf("amount = %q, want %q", got, "1982.00")
	}
	if body.Meta == nil || body.Meta.Page != 2 || body.Meta.Total != 1 {
		t.Errorf("unexpected meta: %+v", body.Meta)
	}
}

func TestGetPayments_NilParamsLeaveFilterEmpty(t *testing.T) {
	uc := &fakePaymentUsecase{}
	h := NewPaymentHandler(uc)

	req := httptest.NewRequest(http.MethodGet, "/dashboard/v1/payments", nil)
	rec := httptest.NewRecorder()
	h.GetDashboardV1Payments(rec, req, openapigen.GetDashboardV1PaymentsParams{})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if uc.listFilter != (entity.PaymentFilter{}) {
		t.Errorf("filter = %+v, want zero value", uc.listFilter)
	}
}

func TestGetPayments_PropagatesUsecaseError(t *testing.T) {
	uc := &fakePaymentUsecase{listErr: entity.ErrorBadRequest("invalid status")}
	h := NewPaymentHandler(uc)

	req := httptest.NewRequest(http.MethodGet, "/dashboard/v1/payments", nil)
	rec := httptest.NewRecorder()
	h.GetDashboardV1Payments(rec, req, openapigen.GetDashboardV1PaymentsParams{})

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body: %s)", rec.Code, rec.Body.String())
	}
	var errBody struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &errBody); err != nil {
		t.Fatalf("decode error body: %v", err)
	}
	if errBody.Code != http.StatusBadRequest || errBody.Message == "" {
		t.Errorf("unexpected error body: %+v", errBody)
	}
}

// --- GetDashboardV1PaymentsExport --------------------------------------------

// serveExport wires the handler behind WithClaims exactly as the real server
// does, so the handler sees claims only when a valid bearer token is present.
func serveExport(uc *fakePaymentUsecase, authHeader string) *httptest.ResponseRecorder {
	h := NewPaymentHandler(uc)
	wrapped := mw.WithClaims(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.GetDashboardV1PaymentsExport(w, r, openapigen.GetDashboardV1PaymentsExportParams{Status: ptr("completed")})
	}))
	req := httptest.NewRequest(http.MethodGet, "/dashboard/v1/payments/export", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	rec := httptest.NewRecorder()
	wrapped.ServeHTTP(rec, req)
	return rec
}

func TestGetPaymentsExport_ForwardsRoleFromClaims(t *testing.T) {
	uc := &fakePaymentUsecase{exportPage: entity.PaymentPage{Items: nil, Total: 0, Page: 1, PerPage: 500}}
	token := signToken(t, jwt.MapClaims{
		"sub": "7", "email": "operation@test.com", "role": "operation",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	rec := serveExport(uc, "Bearer "+token)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	if uc.exportRole != entity.RoleOperation {
		t.Errorf("exportRole = %q, want %q", uc.exportRole, entity.RoleOperation)
	}
	if uc.exportFilter.Status != "completed" {
		t.Errorf("exportFilter.Status = %q, want %q", uc.exportFilter.Status, "completed")
	}
}

func TestGetPaymentsExport_FailsClosedWithoutClaims(t *testing.T) {
	// No token → WithClaims adds nothing → handler passes an empty role, which the
	// (real) usecase rejects. Here the fake returns the forbidden error the usecase
	// would, and we assert the empty role reached it and the 403 is surfaced.
	uc := &fakePaymentUsecase{exportErr: entity.ErrorForbidden("exporting payments requires the operation role")}

	rec := serveExport(uc, "")

	if uc.exportRole != "" {
		t.Errorf("exportRole = %q, want empty (fail-closed)", uc.exportRole)
	}
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403 (body: %s)", rec.Code, rec.Body.String())
	}
	var errBody struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &errBody); err != nil {
		t.Fatalf("decode error body: %v", err)
	}
	if errBody.Code != http.StatusForbidden {
		t.Errorf("code = %d, want %d", errBody.Code, http.StatusForbidden)
	}
}

// --- GetDashboardV1PaymentsSummary -------------------------------------------

func TestGetPaymentsSummary_FormatsAmounts(t *testing.T) {
	uc := &fakePaymentUsecase{summary: entity.PaymentSummary{
		Total: 10, Completed: 6, Processing: 3, Failed: 1,
		TotalAmountCents: 1234567,
		AmountCentsByStatus: map[entity.PaymentStatus]int64{
			entity.PaymentStatusCompleted:  1000000,
			entity.PaymentStatusProcessing: 200000,
			entity.PaymentStatusFailed:     34567,
		},
	}}
	h := NewPaymentHandler(uc)

	req := httptest.NewRequest(http.MethodGet, "/dashboard/v1/payments/summary", nil)
	rec := httptest.NewRecorder()
	h.GetDashboardV1PaymentsSummary(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	if !uc.summaryCalled {
		t.Error("GetSummary was not called")
	}
	var body openapigen.Summary
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Total != 10 || body.Completed != 6 || body.Processing != 3 || body.Failed != 1 {
		t.Errorf("unexpected counts: %+v", body)
	}
	if body.TotalAmount != "12345.67" {
		t.Errorf("TotalAmount = %q, want %q", body.TotalAmount, "12345.67")
	}
	if body.AmountByStatus.Completed != "10000.00" ||
		body.AmountByStatus.Processing != "2000.00" ||
		body.AmountByStatus.Failed != "345.67" {
		t.Errorf("unexpected amountByStatus: %+v", body.AmountByStatus)
	}
}

func TestGetPaymentsSummary_PropagatesError(t *testing.T) {
	uc := &fakePaymentUsecase{summaryErr: entity.ErrorInternal("db down")}
	h := NewPaymentHandler(uc)

	req := httptest.NewRequest(http.MethodGet, "/dashboard/v1/payments/summary", nil)
	rec := httptest.NewRecorder()
	h.GetDashboardV1PaymentsSummary(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500 (body: %s)", rec.Code, rec.Body.String())
	}
}

// --- formatAmount (pure) ------------------------------------------------------

func TestFormatAmount(t *testing.T) {
	cases := []struct {
		cents int64
		want  string
	}{
		{198200, "1982.00"},
		{0, "0.00"},
		{5, "0.05"},
		{99, "0.99"},
		{100, "1.00"},
		{-12345, "-123.45"},
		{-5, "-0.05"},
	}
	for _, c := range cases {
		if got := formatAmount(c.cents); got != c.want {
			t.Errorf("formatAmount(%d) = %q, want %q", c.cents, got, c.want)
		}
	}
}
