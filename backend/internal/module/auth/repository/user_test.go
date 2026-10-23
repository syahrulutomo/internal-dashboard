package repository

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"testing"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
	_ "github.com/mattn/go-sqlite3"
)

// newTestDB creates a temp SQLite database with the users schema and one seeded
// user. The file lives under t.TempDir so it is cleaned up automatically. The
// package is cgo-based (mattn/go-sqlite3), so these tests require CGO_ENABLED=1.
func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := filepath.Join(t.TempDir(), "users.db")
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if _, err := db.Exec(`CREATE TABLE users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL
	);`); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	if _, err := db.Exec(
		`INSERT INTO users(email, password_hash, role) VALUES (?, ?, ?)`,
		"cs@test.com", "hashed-pw", entity.RoleCS,
	); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return db
}

func TestGetUserByEmail_Found(t *testing.T) {
	repo := NewUserRepo(newTestDB(t))

	u, err := repo.GetUserByEmail(context.Background(), "cs@test.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if u.Email != "cs@test.com" || u.Role != entity.RoleCS || u.PasswordHash != "hashed-pw" {
		t.Errorf("unexpected user: %+v", u)
	}
}

func TestGetUserByEmail_NotFound(t *testing.T) {
	repo := NewUserRepo(newTestDB(t))

	_, err := repo.GetUserByEmail(context.Background(), "nobody@test.com")
	if err == nil {
		t.Fatal("expected an error for an unknown user, got nil")
	}
	// An unknown user must surface as a not_found domain error so the login
	// usecase can map it to 401 (invalid credentials) rather than leaking a 500.
	var appErr *entity.AppError
	if !errors.As(err, &appErr) || appErr.Code != entity.ErrorCodeNotFound {
		t.Fatalf("expected not_found AppError, got %v", err)
	}
}
