package usecase

import (
	"context"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
	"github.com/durianpay/fullstack-boilerplate/internal/module/payment/repository"
)

// Pagination defaults and bounds. These mirror the OpenAPI schema so the
// server behaves consistently whether or not the client supplies the params.
const (
	defaultPage    = 1
	defaultPerPage = 20
	maxPerPage     = 100
)

// PaymentUsecase is the application-level contract for payments.
type PaymentUsecase interface {
	ListPayments(ctx context.Context, filter entity.PaymentFilter) (entity.PaymentPage, error)
	ExportPayments(ctx context.Context, filter entity.PaymentFilter, requesterRole string) (entity.PaymentPage, error)
	GetSummary(ctx context.Context) (entity.PaymentSummary, error)
}

type Payment struct {
	repo repository.PaymentRepository
}

func NewPaymentUsecase(repo repository.PaymentRepository) *Payment {
	return &Payment{repo: repo}
}

// ListPayments validates the filter, applies pagination and returns a page of
// matching payments together with pagination metadata. An unknown status value
// is rejected as a bad request rather than silently returning an empty list,
// which gives the client a clear error.
func (u *Payment) ListPayments(ctx context.Context, filter entity.PaymentFilter) (entity.PaymentPage, error) {
	if filter.Status != "" && !entity.PaymentStatus(filter.Status).IsValid() {
		return entity.PaymentPage{}, entity.ErrorBadRequest("invalid status: must be one of completed, processing, failed")
	}

	filter.Page, filter.PerPage = normalizePagination(filter.Page, filter.PerPage)

	total, err := u.repo.Count(ctx, filter)
	if err != nil {
		return entity.PaymentPage{}, err
	}

	items, err := u.repo.List(ctx, filter)
	if err != nil {
		return entity.PaymentPage{}, err
	}

	return entity.PaymentPage{
		Items:      items,
		Total:      total,
		Page:       filter.Page,
		PerPage:    filter.PerPage,
		TotalPages: totalPages(total, filter.PerPage),
	}, nil
}

// ExportPayments returns every payment matching the status filter (up to the
// maxPerPage cap) in a single page, for offline reconciliation. It is the
// role-restricted counterpart to ListPayments: only the operation role may
// export, so a request from any other role is rejected with a forbidden error
// *before* any data is read. Enforcing this here (not just in the UI or the
// handler) keeps the authorization rule in one testable place that every
// transport must go through.
func (u *Payment) ExportPayments(ctx context.Context, filter entity.PaymentFilter, requesterRole string) (entity.PaymentPage, error) {
	if requesterRole != entity.RoleOperation {
		return entity.PaymentPage{}, entity.ErrorForbidden("exporting payments requires the operation role")
	}

	// Export is unpaginated from the caller's perspective: force the first page
	// at the maximum size so the response holds the full matching set.
	filter.Page = defaultPage
	filter.PerPage = maxPerPage
	return u.ListPayments(ctx, filter)
}

// GetSummary returns aggregate figures across all payments for the dashboard
// summary widget. It takes no filter: the widget always reflects the full
// dataset, so the usecase simply delegates to the repository's aggregation.
func (u *Payment) GetSummary(ctx context.Context) (entity.PaymentSummary, error) {
	return u.repo.Summary(ctx)
}

// normalizePagination clamps the requested page/per_page into valid bounds,
// falling back to defaults when unset or out of range.
func normalizePagination(page, perPage int) (int, int) {
	if page < 1 {
		page = defaultPage
	}
	if perPage < 1 {
		perPage = defaultPerPage
	}
	if perPage > maxPerPage {
		perPage = maxPerPage
	}
	return page, perPage
}

// totalPages returns the number of pages needed to hold total items at the
// given page size (ceiling division), and is 0 when there are no items.
func totalPages(total, perPage int) int {
	if total <= 0 || perPage <= 0 {
		return 0
	}
	return (total + perPage - 1) / perPage
}
