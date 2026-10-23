package entity

import "time"

// PaymentStatus is the set of valid payment statuses.
type PaymentStatus string

const (
	PaymentStatusCompleted  PaymentStatus = "completed"
	PaymentStatusProcessing PaymentStatus = "processing"
	PaymentStatusFailed     PaymentStatus = "failed"
)

// IsValid reports whether s is a recognised payment status.
func (s PaymentStatus) IsValid() bool {
	switch s {
	case PaymentStatusCompleted, PaymentStatusProcessing, PaymentStatusFailed:
		return true
	default:
		return false
	}
}

// Payment is a single incoming payment record.
//
// AmountCents stores the monetary value as an integer number of cents so that
// numeric sorting in SQL is correct (lexicographic sorting of a TEXT column
// would order "9" after "100"). The amount is serialised back to a decimal
// string at the transport layer to satisfy the OpenAPI contract.
type Payment struct {
	ID          string
	Merchant    string
	Status      PaymentStatus
	AmountCents int64
	Currency    string
	CreatedAt   time.Time
}

// PaymentFilter captures the supported query options for listing payments.
//
// Page and PerPage drive pagination and are expected to be normalised by the
// usecase layer (Page >= 1, PerPage within sane bounds) before reaching the
// repository, which translates them into SQL LIMIT/OFFSET.
type PaymentFilter struct {
	Status  string // optional: completed | processing | failed
	ID      string // optional: exact payment id
	Search  string // optional: partial match on payment id or merchant name
	Sort    string // optional: comma-separated fields, `-` prefix = desc
	Page    int    // 1-based page number
	PerPage int    // items per page
}

// PaymentSummary holds aggregate figures across all payments for the dashboard
// summary widget: the per-status counts and the settled/pending/failed volume.
// Amounts stay in integer cents here, mirroring entity.Payment, and are
// serialised to decimal strings at the transport layer.
type PaymentSummary struct {
	Total            int
	Completed        int
	Processing       int
	Failed           int
	TotalAmountCents int64
	// AmountCentsByStatus is the summed volume per status, keyed by the status
	// value (completed | processing | failed). All three keys are always
	// present (zero when no payments have that status).
	AmountCentsByStatus map[PaymentStatus]int64
}

// PaymentPage is a single page of payments together with the pagination
// metadata needed to render page controls on the client.
type PaymentPage struct {
	Items      []Payment
	Total      int // total items matching the filter across all pages
	Page       int
	PerPage    int
	TotalPages int
}
