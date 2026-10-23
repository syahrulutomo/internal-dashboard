package repository

import (
	"context"
	"database/sql"
	"strings"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
)

// sortableColumns whitelists the fields that may appear in an ORDER BY clause.
// Sort input is user-controlled, so it is mapped through this allow-list rather
// than interpolated directly, preventing SQL injection.
var sortableColumns = map[string]string{
	"created_at": "created_at",
	"amount":     "amount_cents",
	"merchant":   "merchant",
	"status":     "status",
	"id":         "id",
}

// PaymentRepository is the persistence contract for payments. Every method
// takes a context.Context so a cancelled or timed-out request propagates
// through to the database driver and stops in-flight work.
type PaymentRepository interface {
	List(ctx context.Context, filter entity.PaymentFilter) ([]entity.Payment, error)
	Count(ctx context.Context, filter entity.PaymentFilter) (int, error)
	Summary(ctx context.Context) (entity.PaymentSummary, error)
}

type Payment struct {
	db *sql.DB
}

func NewPaymentRepo(db *sql.DB) *Payment {
	return &Payment{db: db}
}

// buildWhere turns the filter's status/id options into a parameterised WHERE
// clause (without the "WHERE" keyword) and its argument list. It is shared by
// List and Count so both operate over exactly the same result set.
func buildWhere(filter entity.PaymentFilter) (string, []any) {
	var (
		where []string
		args  []any
	)
	if filter.Status != "" {
		where = append(where, "status = ?")
		args = append(args, filter.Status)
	}
	if filter.ID != "" {
		where = append(where, "id = ?")
		args = append(args, filter.ID)
	}
	if filter.Search != "" {
		// Partial, case-insensitive match on id or merchant. The term is
		// wrapped in wildcards, and any LIKE metacharacters (%, _, \) the user
		// typed are escaped so they match literally rather than acting as
		// wildcards (e.g. searching "100%" should not match everything).
		like := "%" + escapeLike(filter.Search) + "%"
		where = append(where, `(id LIKE ? ESCAPE '\' OR merchant LIKE ? ESCAPE '\')`)
		args = append(args, like, like)
	}
	if len(where) == 0 {
		return "", args
	}
	return " WHERE " + strings.Join(where, " AND "), args
}

// escapeLike escapes the SQL LIKE metacharacters so a user-supplied term is
// matched literally. It must be paired with `ESCAPE '\'` in the query.
func escapeLike(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return r.Replace(s)
}

// Count returns the total number of payments matching the filter, ignoring
// pagination. It is used to compute the total page count.
func (r *Payment) Count(ctx context.Context, filter entity.PaymentFilter) (int, error) {
	whereClause, args := buildWhere(filter)
	query := "SELECT COUNT(1) FROM payments" + whereClause

	var total int
	if err := r.db.QueryRowContext(ctx, query, args...).Scan(&total); err != nil {
		return 0, entity.WrapError(err, entity.ErrorCodeInternal, "failed to count payments")
	}
	return total, nil
}

// Summary aggregates counts and volume across all payments, grouped by status,
// in a single scan. GROUP BY omits statuses that have no rows, so the caller
// relies on the map being pre-seeded with every known status at zero.
func (r *Payment) Summary(ctx context.Context) (entity.PaymentSummary, error) {
	summary := entity.PaymentSummary{
		AmountCentsByStatus: map[entity.PaymentStatus]int64{
			entity.PaymentStatusCompleted:  0,
			entity.PaymentStatusProcessing: 0,
			entity.PaymentStatusFailed:     0,
		},
	}

	rows, err := r.db.QueryContext(ctx, "SELECT status, COUNT(1), COALESCE(SUM(amount_cents), 0) FROM payments GROUP BY status")
	if err != nil {
		return entity.PaymentSummary{}, entity.WrapError(err, entity.ErrorCodeInternal, "failed to aggregate payments")
	}
	defer rows.Close()

	for rows.Next() {
		var (
			status      string
			count       int
			amountCents int64
		)
		if err := rows.Scan(&status, &count, &amountCents); err != nil {
			return entity.PaymentSummary{}, entity.WrapError(err, entity.ErrorCodeInternal, "failed to scan summary")
		}

		summary.Total += count
		summary.TotalAmountCents += amountCents
		switch entity.PaymentStatus(status) {
		case entity.PaymentStatusCompleted:
			summary.Completed = count
		case entity.PaymentStatusProcessing:
			summary.Processing = count
		case entity.PaymentStatusFailed:
			summary.Failed = count
		}
		// Unknown statuses still count toward Total/TotalAmount but have no
		// dedicated field or map key; the map only tracks known statuses.
		if _, ok := summary.AmountCentsByStatus[entity.PaymentStatus(status)]; ok {
			summary.AmountCentsByStatus[entity.PaymentStatus(status)] = amountCents
		}
	}
	if err := rows.Err(); err != nil {
		return entity.PaymentSummary{}, entity.WrapError(err, entity.ErrorCodeInternal, "failed to read summary")
	}
	return summary, nil
}

// List returns payments matching the filter. Filtering by status/id is applied
// in SQL, sorting uses a whitelisted ORDER BY, and pagination is applied with
// LIMIT/OFFSET derived from the filter's Page/PerPage. The default order is
// newest first so the dashboard shows the most recent activity.
func (r *Payment) List(ctx context.Context, filter entity.PaymentFilter) ([]entity.Payment, error) {
	whereClause, args := buildWhere(filter)

	query := "SELECT id, merchant, status, amount_cents, currency, created_at FROM payments"
	query += whereClause
	query += " ORDER BY " + buildOrderBy(filter.Sort)

	if filter.PerPage > 0 {
		offset := 0
		if filter.Page > 1 {
			offset = (filter.Page - 1) * filter.PerPage
		}
		query += " LIMIT ? OFFSET ?"
		args = append(args, filter.PerPage, offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, entity.WrapError(err, entity.ErrorCodeInternal, "failed to query payments")
	}
	defer rows.Close()

	payments := make([]entity.Payment, 0)
	for rows.Next() {
		var p entity.Payment
		if err := rows.Scan(&p.ID, &p.Merchant, &p.Status, &p.AmountCents, &p.Currency, &p.CreatedAt); err != nil {
			return nil, entity.WrapError(err, entity.ErrorCodeInternal, "failed to scan payment")
		}
		payments = append(payments, p)
	}
	if err := rows.Err(); err != nil {
		return nil, entity.WrapError(err, entity.ErrorCodeInternal, "failed to read payments")
	}
	return payments, nil
}

// buildOrderBy converts a comma-separated sort string ("-created_at,amount")
// into a safe ORDER BY clause using only whitelisted columns. Unknown fields
// are ignored, and the default is "created_at DESC".
func buildOrderBy(sort string) string {
	const fallback = "created_at DESC"
	if strings.TrimSpace(sort) == "" {
		return fallback
	}

	var clauses []string
	for _, field := range strings.Split(sort, ",") {
		field = strings.TrimSpace(field)
		if field == "" {
			continue
		}
		direction := "ASC"
		if strings.HasPrefix(field, "-") {
			direction = "DESC"
			field = strings.TrimPrefix(field, "-")
		}
		if col, ok := sortableColumns[field]; ok {
			clauses = append(clauses, col+" "+direction)
		}
	}
	if len(clauses) == 0 {
		return fallback
	}
	return strings.Join(clauses, ", ")
}
