package repository

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
	_ "github.com/mattn/go-sqlite3"
)

// newTestDB opens a throwaway SQLite database backed by a temp file (not
// `:memory:`, which is per-connection with database/sql's pool), creates the
// payments schema — copied verbatim from main.go's initDB — and seeds a small
// deterministic fixture. It returns a repository bound to that DB.
func newTestDB(t *testing.T) *Payment {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "test.db")
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS payments (
	  id TEXT PRIMARY KEY,
	  merchant TEXT NOT NULL,
	  status TEXT NOT NULL,
	  amount_cents INTEGER NOT NULL,
	  currency TEXT NOT NULL DEFAULT 'USD',
	  created_at DATETIME NOT NULL
	);`); err != nil {
		t.Fatalf("create schema: %v", err)
	}

	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	seed := []entity.Payment{
		{ID: "PAY-1001", Merchant: "Acme Corp", Status: entity.PaymentStatusCompleted, AmountCents: 10000, Currency: "USD", CreatedAt: base.Add(4 * time.Hour)},
		{ID: "PAY-1002", Merchant: "Globex", Status: entity.PaymentStatusCompleted, AmountCents: 50000, Currency: "USD", CreatedAt: base.Add(3 * time.Hour)},
		{ID: "PAY-1003", Merchant: "Acme Corp", Status: entity.PaymentStatusProcessing, AmountCents: 20000, Currency: "USD", CreatedAt: base.Add(2 * time.Hour)},
		{ID: "PAY-1004", Merchant: "Initech", Status: entity.PaymentStatusFailed, AmountCents: 5000, Currency: "USD", CreatedAt: base.Add(1 * time.Hour)},
		{ID: "PAY-1005", Merchant: "Soylent", Status: entity.PaymentStatusCompleted, AmountCents: 1000, Currency: "USD", CreatedAt: base},
	}
	stmt, err := db.Prepare(`INSERT INTO payments(id, merchant, status, amount_cents, currency, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
	if err != nil {
		t.Fatalf("prepare seed: %v", err)
	}
	defer stmt.Close()
	for _, p := range seed {
		if _, err := stmt.Exec(p.ID, p.Merchant, string(p.Status), p.AmountCents, p.Currency, p.CreatedAt); err != nil {
			t.Fatalf("seed %s: %v", p.ID, err)
		}
	}

	return NewPaymentRepo(db)
}

func TestRepoCount(t *testing.T) {
	repo := newTestDB(t)
	ctx := context.Background()

	if n, err := repo.Count(ctx, entity.PaymentFilter{}); err != nil || n != 5 {
		t.Fatalf("Count(all) = %d, %v; want 5, nil", n, err)
	}
	if n, err := repo.Count(ctx, entity.PaymentFilter{Status: "completed"}); err != nil || n != 3 {
		t.Fatalf("Count(completed) = %d, %v; want 3, nil", n, err)
	}
	if n, err := repo.Count(ctx, entity.PaymentFilter{ID: "PAY-1004"}); err != nil || n != 1 {
		t.Fatalf("Count(id) = %d, %v; want 1, nil", n, err)
	}
}

func TestRepoListSortingAndPagination(t *testing.T) {
	repo := newTestDB(t)
	ctx := context.Background()

	// Default order is newest first (created_at desc).
	items, err := repo.List(ctx, entity.PaymentFilter{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 5 {
		t.Fatalf("len = %d, want 5", len(items))
	}
	if items[0].ID != "PAY-1001" || items[4].ID != "PAY-1005" {
		t.Errorf("default sort wrong: first=%s last=%s", items[0].ID, items[4].ID)
	}

	// Ascending by amount.
	items, err = repo.List(ctx, entity.PaymentFilter{Sort: "amount"})
	if err != nil {
		t.Fatalf("List(sort=amount): %v", err)
	}
	if items[0].AmountCents != 1000 || items[len(items)-1].AmountCents != 50000 {
		t.Errorf("amount asc wrong: first=%d last=%d", items[0].AmountCents, items[len(items)-1].AmountCents)
	}

	// Pagination: page 1 of 2.
	page1, err := repo.List(ctx, entity.PaymentFilter{Sort: "amount", Page: 1, PerPage: 2})
	if err != nil {
		t.Fatalf("List(page1): %v", err)
	}
	if len(page1) != 2 || page1[0].AmountCents != 1000 || page1[1].AmountCents != 5000 {
		t.Errorf("page1 wrong: %+v", page1)
	}
	page2, err := repo.List(ctx, entity.PaymentFilter{Sort: "amount", Page: 2, PerPage: 2})
	if err != nil {
		t.Fatalf("List(page2): %v", err)
	}
	if len(page2) != 2 || page2[0].AmountCents != 10000 {
		t.Errorf("page2 wrong: %+v", page2)
	}
}

func TestRepoListSearch(t *testing.T) {
	repo := newTestDB(t)
	ctx := context.Background()

	// Case-insensitive partial match on merchant.
	items, err := repo.List(ctx, entity.PaymentFilter{Search: "acme"})
	if err != nil {
		t.Fatalf("List(search): %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("search merchant: got %d, want 2", len(items))
	}

	// Partial match on payment id.
	items, err = repo.List(ctx, entity.PaymentFilter{Search: "PAY-1004"})
	if err != nil {
		t.Fatalf("List(search id): %v", err)
	}
	if len(items) != 1 || items[0].ID != "PAY-1004" {
		t.Errorf("search id: got %+v", items)
	}
}

func TestRepoSummary(t *testing.T) {
	repo := newTestDB(t)

	s, err := repo.Summary(context.Background())
	if err != nil {
		t.Fatalf("Summary: %v", err)
	}
	if s.Total != 5 || s.Completed != 3 || s.Processing != 1 || s.Failed != 1 {
		t.Errorf("counts wrong: %+v", s)
	}
	if s.TotalAmountCents != 86000 {
		t.Errorf("TotalAmountCents = %d, want 86000", s.TotalAmountCents)
	}
	// All three known status keys are always present.
	if got := s.AmountCentsByStatus[entity.PaymentStatusCompleted]; got != 61000 {
		t.Errorf("completed volume = %d, want 61000", got)
	}
	if got := s.AmountCentsByStatus[entity.PaymentStatusProcessing]; got != 20000 {
		t.Errorf("processing volume = %d, want 20000", got)
	}
	if got := s.AmountCentsByStatus[entity.PaymentStatusFailed]; got != 5000 {
		t.Errorf("failed volume = %d, want 5000", got)
	}
}

func TestRepoSummaryEmpty(t *testing.T) {
	// A fresh DB with no rows: all three keys present at zero.
	dbPath := filepath.Join(t.TempDir(), "empty.db")
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if _, err := db.Exec(`CREATE TABLE payments (id TEXT PRIMARY KEY, merchant TEXT, status TEXT, amount_cents INTEGER, currency TEXT, created_at DATETIME);`); err != nil {
		t.Fatalf("schema: %v", err)
	}

	s, err := NewPaymentRepo(db).Summary(context.Background())
	if err != nil {
		t.Fatalf("Summary: %v", err)
	}
	if s.Total != 0 || len(s.AmountCentsByStatus) != 3 {
		t.Errorf("empty summary wrong: %+v", s)
	}
}
