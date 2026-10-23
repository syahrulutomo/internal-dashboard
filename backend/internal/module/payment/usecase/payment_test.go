package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
)

// fakePaymentRepo records the filter it received and returns a fixed result.
type fakePaymentRepo struct {
	gotFilter entity.PaymentFilter
	result    []entity.Payment
	total     int
	summary   entity.PaymentSummary
	err       error
}

func (f *fakePaymentRepo) List(_ context.Context, filter entity.PaymentFilter) ([]entity.Payment, error) {
	f.gotFilter = filter
	return f.result, f.err
}

func (f *fakePaymentRepo) Count(_ context.Context, filter entity.PaymentFilter) (int, error) {
	return f.total, f.err
}

func (f *fakePaymentRepo) Summary(_ context.Context) (entity.PaymentSummary, error) {
	return f.summary, f.err
}

func TestListPayments_PassesFilterThrough(t *testing.T) {
	repo := &fakePaymentRepo{result: []entity.Payment{{ID: "PAY-1"}}, total: 1}
	uc := NewPaymentUsecase(repo)

	filter := entity.PaymentFilter{Status: "completed", ID: "PAY-1", Sort: "-created_at"}
	out, err := uc.ListPayments(context.Background(), filter)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out.Items) != 1 {
		t.Fatalf("expected 1 payment, got %d", len(out.Items))
	}
	// Status/ID/Sort must reach the repository unchanged; pagination is
	// normalised by the usecase, so assert those fields on what the repo saw.
	if repo.gotFilter.Status != filter.Status || repo.gotFilter.ID != filter.ID || repo.gotFilter.Sort != filter.Sort {
		t.Errorf("filter not passed through: got %+v want %+v", repo.gotFilter, filter)
	}
}

func TestListPayments_PaginationDefaultsAndMeta(t *testing.T) {
	repo := &fakePaymentRepo{result: []entity.Payment{{ID: "PAY-1"}}, total: 48}
	uc := NewPaymentUsecase(repo)

	out, err := uc.ListPayments(context.Background(), entity.PaymentFilter{}) // no page/per_page supplied
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Page != 1 || out.PerPage != 20 {
		t.Errorf("expected default page=1 per_page=20, got page=%d per_page=%d", out.Page, out.PerPage)
	}
	if out.Total != 48 || out.TotalPages != 3 {
		t.Errorf("expected total=48 total_pages=3, got total=%d total_pages=%d", out.Total, out.TotalPages)
	}
	// Defaults must also be propagated to the repository for LIMIT/OFFSET.
	if repo.gotFilter.Page != 1 || repo.gotFilter.PerPage != 20 {
		t.Errorf("defaults not passed to repo: got page=%d per_page=%d", repo.gotFilter.Page, repo.gotFilter.PerPage)
	}
}

func TestListPayments_PerPageClampedToMax(t *testing.T) {
	repo := &fakePaymentRepo{total: 10}
	uc := NewPaymentUsecase(repo)

	out, err := uc.ListPayments(context.Background(), entity.PaymentFilter{PerPage: 1000})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.PerPage != 100 {
		t.Errorf("expected per_page clamped to 100, got %d", out.PerPage)
	}
}

func TestListPayments_ValidStatuses(t *testing.T) {
	for _, s := range []string{"completed", "processing", "failed", ""} {
		repo := &fakePaymentRepo{}
		uc := NewPaymentUsecase(repo)
		if _, err := uc.ListPayments(context.Background(), entity.PaymentFilter{Status: s}); err != nil {
			t.Errorf("status %q should be valid, got error: %v", s, err)
		}
	}
}

func TestGetSummary_DelegatesToRepo(t *testing.T) {
	want := entity.PaymentSummary{
		Total:            3,
		Completed:        2,
		Failed:           1,
		TotalAmountCents: 15000,
		AmountCentsByStatus: map[entity.PaymentStatus]int64{
			entity.PaymentStatusCompleted:  12000,
			entity.PaymentStatusProcessing: 0,
			entity.PaymentStatusFailed:     3000,
		},
	}
	repo := &fakePaymentRepo{summary: want}
	uc := NewPaymentUsecase(repo)

	got, err := uc.GetSummary(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Total != want.Total || got.Completed != want.Completed || got.Failed != want.Failed {
		t.Errorf("counts mismatch: got %+v want %+v", got, want)
	}
	if got.TotalAmountCents != want.TotalAmountCents {
		t.Errorf("total amount mismatch: got %d want %d", got.TotalAmountCents, want.TotalAmountCents)
	}
	if got.AmountCentsByStatus[entity.PaymentStatusCompleted] != 12000 {
		t.Errorf("completed amount mismatch: got %d", got.AmountCentsByStatus[entity.PaymentStatusCompleted])
	}
}

func TestGetSummary_PropagatesError(t *testing.T) {
	repo := &fakePaymentRepo{err: errors.New("db down")}
	uc := NewPaymentUsecase(repo)

	if _, err := uc.GetSummary(context.Background()); err == nil {
		t.Fatal("expected error to propagate from repository, got nil")
	}
}

func TestExportPayments_ForbiddenForNonOperationRole(t *testing.T) {
	for _, role := range []string{entity.RoleCS, "", "admin"} {
		repo := &fakePaymentRepo{result: []entity.Payment{{ID: "PAY-1"}}, total: 1}
		uc := NewPaymentUsecase(repo)

		_, err := uc.ExportPayments(context.Background(), entity.PaymentFilter{}, role)
		if err == nil {
			t.Fatalf("role %q: expected forbidden error, got nil", role)
		}
		var appErr *entity.AppError
		if !errors.As(err, &appErr) || appErr.Code != entity.ErrorCodeForbidden {
			t.Fatalf("role %q: expected forbidden error, got %v", role, err)
		}
		// Authorization must fail closed — no data is read for a denied role.
		if repo.gotFilter.PerPage != 0 {
			t.Errorf("role %q: repository must not be queried when forbidden", role)
		}
	}
}

func TestExportPayments_OperationReturnsFullSet(t *testing.T) {
	repo := &fakePaymentRepo{result: []entity.Payment{{ID: "PAY-1"}, {ID: "PAY-2"}}, total: 2}
	uc := NewPaymentUsecase(repo)

	out, err := uc.ExportPayments(
		context.Background(),
		entity.PaymentFilter{Status: "completed", Page: 3, PerPage: 5},
		entity.RoleOperation,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out.Items) != 2 {
		t.Fatalf("expected 2 payments, got %d", len(out.Items))
	}
	// Export ignores the caller's pagination and asks the repository for the
	// first page at the maximum size so the whole matching set comes back.
	if repo.gotFilter.Page != 1 || repo.gotFilter.PerPage != maxPerPage {
		t.Errorf("expected export to force page=1 per_page=%d, got page=%d per_page=%d",
			maxPerPage, repo.gotFilter.Page, repo.gotFilter.PerPage)
	}
	// The status filter must still reach the repository.
	if repo.gotFilter.Status != "completed" {
		t.Errorf("status filter not passed through: got %q", repo.gotFilter.Status)
	}
}

func TestExportPayments_ValidatesStatusForAuthorizedRole(t *testing.T) {
	repo := &fakePaymentRepo{}
	uc := NewPaymentUsecase(repo)

	_, err := uc.ExportPayments(context.Background(), entity.PaymentFilter{Status: "refunded"}, entity.RoleOperation)
	var appErr *entity.AppError
	if !errors.As(err, &appErr) || appErr.Code != entity.ErrorCodeBadRequest {
		t.Fatalf("expected bad_request for invalid status, got %v", err)
	}
}

func TestListPayments_InvalidStatus(t *testing.T) {
	repo := &fakePaymentRepo{}
	uc := NewPaymentUsecase(repo)

	_, err := uc.ListPayments(context.Background(), entity.PaymentFilter{Status: "refunded"})
	if err == nil {
		t.Fatal("expected error for invalid status, got nil")
	}
	var appErr *entity.AppError
	if !errors.As(err, &appErr) || appErr.Code != entity.ErrorCodeBadRequest {
		t.Fatalf("expected bad_request error, got %v", err)
	}
	// The repository must not be queried when validation fails.
	if repo.gotFilter.Status != "" {
		t.Error("repository should not be called for an invalid status")
	}
}
