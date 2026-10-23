package main

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/durianpay/fullstack-boilerplate/internal/api"
	"github.com/durianpay/fullstack-boilerplate/internal/config"
	hh "github.com/durianpay/fullstack-boilerplate/internal/module/health/handler"

	ah "github.com/durianpay/fullstack-boilerplate/internal/module/auth/handler"
	ar "github.com/durianpay/fullstack-boilerplate/internal/module/auth/repository"
	au "github.com/durianpay/fullstack-boilerplate/internal/module/auth/usecase"
	ph "github.com/durianpay/fullstack-boilerplate/internal/module/payment/handler"
	pr "github.com/durianpay/fullstack-boilerplate/internal/module/payment/repository"
	pu "github.com/durianpay/fullstack-boilerplate/internal/module/payment/usecase"
	srv "github.com/durianpay/fullstack-boilerplate/internal/service/http"
	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	_ = godotenv.Load()

	logger := newLogger()
	slog.SetDefault(logger)

	// Fail fast on an unsafe configuration rather than silently serving with a
	// default secret or wide-open CORS in production.
	if err := config.Validate(); err != nil {
		logger.Error("invalid configuration", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// busy_timeout lets concurrent writers wait briefly for the lock instead of
	// immediately failing with "database is locked" — important once more than
	// one request hits SQLite at a time. The path is configurable (DB_PATH) so
	// it can point at a mounted volume in containers.
	dsn := config.DBPath + "?_foreign_keys=1&_busy_timeout=5000&_journal_mode=WAL"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		logger.Error("open database", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer db.Close()

	if err := initDB(db); err != nil {
		logger.Error("init database", slog.String("error", err.Error()))
		os.Exit(1)
	}

	JwtExpiredDuration, err := time.ParseDuration(config.JwtExpired)
	if err != nil {
		logger.Error("invalid JWT_EXPIRED duration", slog.String("error", err.Error()))
		os.Exit(1)
	}

	userRepo := ar.NewUserRepo(db)
	authUC := au.NewAuthUsecase(userRepo, config.JwtSecret, JwtExpiredDuration)
	authH := ah.NewAuthHandler(authUC)

	paymentRepo := pr.NewPaymentRepo(db)
	paymentUC := pu.NewPaymentUsecase(paymentRepo)
	paymentH := ph.NewPaymentHandler(paymentUC)

	healthH := hh.NewHealthHandler()

	apiHandler := &api.APIHandler{
		Auth:    authH,
		Payment: paymentH,
		Health:  healthH,
	}

	// Readiness depends on the database actually answering.
	ready := func(ctx context.Context) error { return db.PingContext(ctx) }

	server := srv.NewServer(apiHandler, config.OpenapiYamlLocation, logger, ready)

	logger.Info("starting server", slog.String("addr", config.HttpAddress), slog.String("env", config.Env))
	server.Start(config.HttpAddress)
}

// newLogger builds the application logger: human-readable text in development,
// machine-parseable JSON in production (for log aggregation).
func newLogger() *slog.Logger {
	if config.IsProduction() {
		return slog.New(slog.NewJSONHandler(os.Stdout, nil))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, nil))
}

func initDB(db *sql.DB) error {
	// create tables if not exists
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
		  id INTEGER PRIMARY KEY AUTOINCREMENT,
		  email TEXT NOT NULL UNIQUE,
		  password_hash TEXT NOT NULL,
		  role TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS payments (
		  id TEXT PRIMARY KEY,
		  merchant TEXT NOT NULL,
		  status TEXT NOT NULL,
		  amount_cents INTEGER NOT NULL,
		  currency TEXT NOT NULL DEFAULT 'USD',
		  created_at DATETIME NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);`,
		`CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	// seed admin user if not exists
	var cnt int
	row := db.QueryRow("SELECT COUNT(1) FROM users")
	if err := row.Scan(&cnt); err != nil {
		return err
	}
	if cnt == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte("password"), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		if _, err := db.Exec("INSERT INTO users(email, password_hash, role) VALUES (?, ?, ?)", "cs@test.com", string(hash), "cs"); err != nil {
			return err
		}
		if _, err := db.Exec("INSERT INTO users(email, password_hash, role) VALUES (?, ?, ?)", "operation@test.com", string(hash), "operation"); err != nil {
			return err
		}
	}

	if err := seedPayments(db); err != nil {
		return err
	}

	const dbLifetime = time.Minute * 5
	db.SetConnMaxLifetime(dbLifetime)
	return nil
}

// seedPayments populates a data-rich, deterministic set of payments the first
// time the table is empty. The distribution favours completed payments with a
// healthy mix of processing and failed so the dashboard summary is meaningful.
func seedPayments(db *sql.DB) error {
	var cnt int
	if err := db.QueryRow("SELECT COUNT(1) FROM payments").Scan(&cnt); err != nil {
		return err
	}
	if cnt > 0 {
		return nil
	}

	merchants := []string{
		"Acme Corp", "Globex", "Soylent Co", "Initech", "Umbrella Inc",
		"Stark Industries", "Wayne Enterprises", "Wonka Industries", "Hooli",
		"Pied Piper", "Vandelay Imports", "Gringotts Bank", "Cyberdyne",
		"Oscorp", "Massive Dynamic",
	}
	// Weighted status pattern (~60% completed, ~25% processing, ~15% failed).
	statuses := []string{
		"completed", "completed", "completed", "processing",
		"completed", "failed", "completed", "processing",
		"completed", "completed", "processing", "failed",
		"completed",
	}

	const seedCount = 48
	base := time.Now().UTC()

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare(`INSERT INTO payments(id, merchant, status, amount_cents, currency, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	defer stmt.Close()

	for i := 0; i < seedCount; i++ {
		id := fmt.Sprintf("PAY-%04d", 1001+i)
		merchant := merchants[i%len(merchants)]
		status := statuses[i%len(statuses)]
		// Deterministic but varied amounts between ~$50 and ~$5,000.
		amountCents := int64(5000 + (i*37%495)*1000 + (i * 13 % 100))
		// Spread over roughly the last 30 days, a few hours apart.
		createdAt := base.Add(-time.Duration(i) * 13 * time.Hour)

		if _, err := stmt.Exec(id, merchant, status, amountCents, "USD", createdAt); err != nil {
			_ = tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}
