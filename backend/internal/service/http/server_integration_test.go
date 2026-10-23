package http_test

// Black-box integration tests that exercise the full HTTP stack end to end:
// chi router → CORS → login rate limiter → OpenAPI request validator → JWT
// authenticator → generated handlers → usecases → real SQLite repositories.
//
// Unlike the usecase/middleware unit tests, these wire the production
// components together exactly as main.go does and drive them through
// httptest, so they catch contract regressions (routing, validation, auth
// enforcement, DTO shapes) that unit tests can't. They use a real on-disk
// SQLite database, so the package must be built with CGO_ENABLED=1.

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/durianpay/fullstack-boilerplate/internal/api"
	"github.com/durianpay/fullstack-boilerplate/internal/config"
	ah "github.com/durianpay/fullstack-boilerplate/internal/module/auth/handler"
	ar "github.com/durianpay/fullstack-boilerplate/internal/module/auth/repository"
	au "github.com/durianpay/fullstack-boilerplate/internal/module/auth/usecase"
	hh "github.com/durianpay/fullstack-boilerplate/internal/module/health/handler"
	ph "github.com/durianpay/fullstack-boilerplate/internal/module/payment/handler"
	pr "github.com/durianpay/fullstack-boilerplate/internal/module/payment/repository"
	pu "github.com/durianpay/fullstack-boilerplate/internal/module/payment/usecase"
	srv "github.com/durianpay/fullstack-boilerplate/internal/service/http"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

const (
	testEmail    = "cs@test.com"
	testRole     = "cs"
	testPassword = "password"
	opEmail      = "operation@test.com"
	opRole       = "operation"
	loginPath    = "/dashboard/v1/auth/login"
	mePath       = "/dashboard/v1/auth/me"
	paymentsPath = "/dashboard/v1/payments"
	exportPath   = "/dashboard/v1/payments/export"
	summaryPath  = "/dashboard/v1/payments/summary"
)

// seedPayment is one fixed payment used to build a deterministic dataset so the
// summary/filter assertions below are exact.
type seedPayment struct {
	id          string
	merchant    string
	status      string
	amountCents int64
}

// fixture: 5 payments — 3 completed, 1 processing, 1 failed — with known
// amounts so the summary totals are predictable.
var seedPayments = []seedPayment{
	{"PAY-0001", "Acme Corp", "completed", 100000}, // $1000.00
	{"PAY-0002", "Globex", "completed", 200000},    // $2000.00
	{"PAY-0003", "Initech", "completed", 50000},    //  $500.00
	{"PAY-0004", "Hooli", "processing", 30000},     //  $300.00
	{"PAY-0005", "Oscorp", "failed", 10000},        //  $100.00
}

// newTestHandler wires the production component graph against a fresh, seeded
// SQLite database and returns the assembled router. Tokens are signed with the
// same config.JwtSecret the server validates against, so login-issued tokens
// are accepted by the JWT authenticator.
func newTestHandler(t *testing.T) http.Handler {
	t.Helper()

	db := newSeededDB(t)

	userRepo := ar.NewUserRepo(db)
	authUC := au.NewAuthUsecase(userRepo, config.JwtSecret, time.Hour)
	authH := ah.NewAuthHandler(authUC)

	paymentRepo := pr.NewPaymentRepo(db)
	paymentUC := pu.NewPaymentUsecase(paymentRepo)
	paymentH := ph.NewPaymentHandler(paymentUC)

	apiHandler := &api.APIHandler{
		Auth:    authH,
		Payment: paymentH,
		Health:  hh.NewHealthHandler(),
	}

	ready := func(ctx context.Context) error { return db.PingContext(ctx) }
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	server := srv.NewServer(apiHandler, config.OpenapiYamlLocation, logger, ready)
	return server.Routes()
}

// newSeededDB creates a temp SQLite database with the application schema and a
// deterministic set of users and payments. The file lives under t.TempDir so
// it is removed automatically when the test finishes.
func newSeededDB(t *testing.T) *sql.DB {
	t.Helper()

	dsn := filepath.Join(t.TempDir(), "test.db") + "?_busy_timeout=5000&_journal_mode=WAL"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	schema := []string{
		`CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL
		);`,
		`CREATE TABLE payments (
			id TEXT PRIMARY KEY,
			merchant TEXT NOT NULL,
			status TEXT NOT NULL,
			amount_cents INTEGER NOT NULL,
			currency TEXT NOT NULL DEFAULT 'USD',
			created_at DATETIME NOT NULL
		);`,
	}
	for _, s := range schema {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("create schema: %v", err)
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	// Seed one user per role so authorization differences (e.g. export) can be
	// exercised. Both share the same password hash.
	users := []struct{ email, role string }{
		{testEmail, testRole},
		{opEmail, opRole},
	}
	for _, u := range users {
		if _, err := db.Exec(
			`INSERT INTO users(email, password_hash, role) VALUES (?, ?, ?)`,
			u.email, string(hash), u.role,
		); err != nil {
			t.Fatalf("seed user %s: %v", u.email, err)
		}
	}

	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	for i, p := range seedPayments {
		// Spread created_at so ordering is deterministic (newest = PAY-0005).
		createdAt := base.Add(time.Duration(i) * time.Hour)
		if _, err := db.Exec(
			`INSERT INTO payments(id, merchant, status, amount_cents, currency, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
			p.id, p.merchant, p.status, p.amountCents, "USD", createdAt,
		); err != nil {
			t.Fatalf("seed payment %s: %v", p.id, err)
		}
	}

	return db
}

// do issues a request against the handler and returns the recorder.
func do(t *testing.T, h http.Handler, method, target, body string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, target, r)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// bearer returns the headers for an authenticated JSON request.
func bearer(token string) map[string]string {
	return map[string]string{"Authorization": "Bearer " + token}
}

// loginToken performs a real login as the default (cs) user and returns the JWT.
func loginToken(t *testing.T, h http.Handler) string {
	t.Helper()
	return loginTokenAs(t, h, testEmail)
}

// loginTokenAs performs a real login as the given seeded user and returns the
// issued JWT (all seeded users share testPassword).
func loginTokenAs(t *testing.T, h http.Handler, email string) string {
	t.Helper()
	rec := do(t, h, http.MethodPost, loginPath,
		`{"email":"`+email+`","password":"`+testPassword+`"}`,
		map[string]string{"Content-Type": "application/json"})
	if rec.Code != http.StatusOK {
		t.Fatalf("login: status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("login: decode body: %v", err)
	}
	if resp.Token == "" {
		t.Fatal("login: empty token")
	}
	return resp.Token
}

func decode(t *testing.T, rec *httptest.ResponseRecorder, dst any) {
	t.Helper()
	if err := json.Unmarshal(rec.Body.Bytes(), dst); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body.String(), err)
	}
}

func TestIntegration_Health(t *testing.T) {
	h := newTestHandler(t)

	rec := do(t, h, http.MethodGet, "/health", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var body struct {
		Status string `json:"status"`
		Time   string `json:"time"`
	}
	decode(t, rec, &body)
	if body.Status == "" || body.Time == "" {
		t.Errorf("expected status and time, got %+v", body)
	}
}

func TestIntegration_Login(t *testing.T) {
	h := newTestHandler(t)

	t.Run("success returns token and user", func(t *testing.T) {
		rec := do(t, h, http.MethodPost, loginPath,
			`{"email":"`+testEmail+`","password":"`+testPassword+`"}`,
			map[string]string{"Content-Type": "application/json"})
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		var body struct {
			Email string `json:"email"`
			Role  string `json:"role"`
			Token string `json:"token"`
		}
		decode(t, rec, &body)
		if body.Email != testEmail || body.Role != testRole || body.Token == "" {
			t.Errorf("unexpected login body: %+v", body)
		}
	})

	t.Run("wrong password is 401", func(t *testing.T) {
		rec := do(t, h, http.MethodPost, loginPath,
			`{"email":"`+testEmail+`","password":"nope"}`,
			map[string]string{"Content-Type": "application/json"})
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		// Must not reveal whether the account exists.
		assertErrorBody(t, rec, http.StatusUnauthorized)
	})

	t.Run("missing required field is rejected by the validator", func(t *testing.T) {
		// Body omits `password`, which the spec marks required — the OpenAPI
		// validator must reject it before it reaches the handler.
		rec := do(t, h, http.MethodPost, loginPath,
			`{"email":"`+testEmail+`"}`,
			map[string]string{"Content-Type": "application/json"})
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		assertErrorBody(t, rec, http.StatusBadRequest)
	})
}

// TestIntegration_AuthMe exercises GET /auth/me through the whole stack: the
// validator enforces bearerAuth, WithClaims surfaces the token's claims, and the
// handler echoes the caller's identity (never the token itself).
func TestIntegration_AuthMe(t *testing.T) {
	h := newTestHandler(t)

	t.Run("no token is 401 (validator)", func(t *testing.T) {
		rec := do(t, h, http.MethodGet, mePath, "", nil)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		assertErrorBody(t, rec, http.StatusUnauthorized)
	})

	t.Run("returns the caller's identity, per role, without echoing the token", func(t *testing.T) {
		for _, tc := range []struct{ email, role string }{
			{testEmail, testRole},
			{opEmail, opRole},
		} {
			token := loginTokenAs(t, h, tc.email)
			rec := do(t, h, http.MethodGet, mePath, "", bearer(token))
			if rec.Code != http.StatusOK {
				t.Fatalf("%s: status = %d, body = %s", tc.email, rec.Code, rec.Body.String())
			}
			var body map[string]any
			decode(t, rec, &body)
			if body["email"] != tc.email || body["role"] != tc.role {
				t.Errorf("%s: body = %v, want email=%q role=%q", tc.email, body, tc.email, tc.role)
			}
			if _, ok := body["token"]; ok {
				t.Errorf("%s: /me must not echo a token: %v", tc.email, body)
			}
		}
	})
}

func TestIntegration_PaymentsAuth(t *testing.T) {
	h := newTestHandler(t)

	t.Run("no token is 401", func(t *testing.T) {
		rec := do(t, h, http.MethodGet, paymentsPath, "", nil)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		assertErrorBody(t, rec, http.StatusUnauthorized)
	})

	t.Run("garbage token is 401", func(t *testing.T) {
		rec := do(t, h, http.MethodGet, paymentsPath, "", bearer("not.a.jwt"))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("valid token returns the full page", func(t *testing.T) {
		token := loginToken(t, h)
		rec := do(t, h, http.MethodGet, paymentsPath, "", bearer(token))
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		var body paymentListBody
		decode(t, rec, &body)
		if body.Meta.Total != len(seedPayments) {
			t.Errorf("meta.total = %d, want %d", body.Meta.Total, len(seedPayments))
		}
		if body.Meta.PerPage != 20 {
			t.Errorf("meta.per_page = %d, want default 20", body.Meta.PerPage)
		}
		if len(body.Payments) != len(seedPayments) {
			t.Errorf("got %d payments, want %d", len(body.Payments), len(seedPayments))
		}
	})
}

func TestIntegration_PaymentsFiltering(t *testing.T) {
	h := newTestHandler(t)
	token := loginToken(t, h)

	t.Run("filter by status returns only matches", func(t *testing.T) {
		rec := do(t, h, http.MethodGet, paymentsPath+"?status=completed", "", bearer(token))
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		var body paymentListBody
		decode(t, rec, &body)
		if body.Meta.Total != 3 {
			t.Errorf("meta.total = %d, want 3 completed", body.Meta.Total)
		}
		for _, p := range body.Payments {
			if p.Status != "completed" {
				t.Errorf("got payment with status %q, want completed", p.Status)
			}
		}
	})

	t.Run("invalid status is a 400 from the usecase", func(t *testing.T) {
		// `status` is a free-form string in the spec, so the invalid value
		// passes validation and the usecase rejects it as a bad request.
		rec := do(t, h, http.MethodGet, paymentsPath+"?status=bogus", "", bearer(token))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		assertErrorBody(t, rec, http.StatusBadRequest)
	})

	t.Run("pagination metadata is correct", func(t *testing.T) {
		rec := do(t, h, http.MethodGet, paymentsPath+"?per_page=2&page=1", "", bearer(token))
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		var body paymentListBody
		decode(t, rec, &body)
		if body.Meta.PerPage != 2 || body.Meta.Page != 1 {
			t.Errorf("meta page/per_page = %d/%d, want 1/2", body.Meta.Page, body.Meta.PerPage)
		}
		if body.Meta.Total != 5 || body.Meta.TotalPages != 3 {
			t.Errorf("meta total/total_pages = %d/%d, want 5/3", body.Meta.Total, body.Meta.TotalPages)
		}
		if len(body.Payments) != 2 {
			t.Errorf("got %d payments, want 2 (page size)", len(body.Payments))
		}
	})

	t.Run("per_page above the spec maximum is rejected by the validator", func(t *testing.T) {
		rec := do(t, h, http.MethodGet, paymentsPath+"?per_page=500", "", bearer(token))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
	})
}

// TestIntegration_PaymentsExportRBAC proves role enforcement through the whole
// stack: the WithClaims middleware must surface the JWT role to the handler, and
// the usecase must authorize it — operation succeeds, cs is forbidden, and an
// unauthenticated request is still stopped at the validator.
func TestIntegration_PaymentsExportRBAC(t *testing.T) {
	h := newTestHandler(t)

	t.Run("no token is 401 (validator)", func(t *testing.T) {
		rec := do(t, h, http.MethodGet, exportPath, "", nil)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		assertErrorBody(t, rec, http.StatusUnauthorized)
	})

	t.Run("cs role is 403 (forbidden)", func(t *testing.T) {
		token := loginTokenAs(t, h, testEmail)
		rec := do(t, h, http.MethodGet, exportPath, "", bearer(token))
		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		assertErrorBody(t, rec, http.StatusForbidden)
	})

	t.Run("operation role exports the full matching set", func(t *testing.T) {
		token := loginTokenAs(t, h, opEmail)
		rec := do(t, h, http.MethodGet, exportPath, "", bearer(token))
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		var body paymentListBody
		decode(t, rec, &body)
		if len(body.Payments) != len(seedPayments) {
			t.Errorf("got %d payments, want %d", len(body.Payments), len(seedPayments))
		}
		// Export forces the max page size so the whole set is returned at once.
		if body.Meta.PerPage != 100 {
			t.Errorf("meta.per_page = %d, want 100 (export cap)", body.Meta.PerPage)
		}
	})

	t.Run("operation role honours the status filter", func(t *testing.T) {
		token := loginTokenAs(t, h, opEmail)
		rec := do(t, h, http.MethodGet, exportPath+"?status=completed", "", bearer(token))
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		var body paymentListBody
		decode(t, rec, &body)
		if body.Meta.Total != 3 {
			t.Errorf("meta.total = %d, want 3 completed", body.Meta.Total)
		}
	})
}

func TestIntegration_Summary(t *testing.T) {
	h := newTestHandler(t)

	t.Run("without token is 401", func(t *testing.T) {
		rec := do(t, h, http.MethodGet, summaryPath, "", nil)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("aggregates match the seeded dataset", func(t *testing.T) {
		token := loginToken(t, h)
		rec := do(t, h, http.MethodGet, summaryPath, "", bearer(token))
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		var s summaryBody
		decode(t, rec, &s)

		if s.Total != 5 || s.Completed != 3 || s.Processing != 1 || s.Failed != 1 {
			t.Errorf("counts = %+v, want total 5 / completed 3 / processing 1 / failed 1", s)
		}
		// 100000+200000+50000+30000+10000 = 390000 cents.
		if s.TotalAmount != "3900.00" {
			t.Errorf("total_amount = %q, want 3900.00", s.TotalAmount)
		}
		if s.AmountByStatus.Completed != "3500.00" {
			t.Errorf("amount_by_status.completed = %q, want 3500.00", s.AmountByStatus.Completed)
		}
		if s.AmountByStatus.Processing != "300.00" {
			t.Errorf("amount_by_status.processing = %q, want 300.00", s.AmountByStatus.Processing)
		}
		if s.AmountByStatus.Failed != "100.00" {
			t.Errorf("amount_by_status.failed = %q, want 100.00", s.AmountByStatus.Failed)
		}
	})
}

func TestIntegration_CORSPreflightShortCircuitsValidator(t *testing.T) {
	h := newTestHandler(t)

	// A preflight OPTIONS to a protected route carries no token and matches no
	// spec route, so it would be rejected if the validator saw it. CORS must
	// answer it with 204 and the allow-origin header first.
	rec := do(t, h, http.MethodOptions, paymentsPath, "", map[string]string{
		"Origin":                        "http://localhost:3000",
		"Access-Control-Request-Method": http.MethodGet,
	})
	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Errorf("Access-Control-Allow-Origin = %q, want http://localhost:3000", got)
	}
}

// --- response shapes mirroring the OpenAPI contract ---

type paymentListBody struct {
	Payments []struct {
		Id       string `json:"id"`
		Merchant string `json:"merchant"`
		Status   string `json:"status"`
		Amount   string `json:"amount"`
	} `json:"payments"`
	Meta struct {
		Page       int `json:"page"`
		PerPage    int `json:"per_page"`
		Total      int `json:"total"`
		TotalPages int `json:"total_pages"`
	} `json:"meta"`
}

type summaryBody struct {
	Total          int    `json:"total"`
	Completed      int    `json:"completed"`
	Processing     int    `json:"processing"`
	Failed         int    `json:"failed"`
	TotalAmount    string `json:"total_amount"`
	AmountByStatus struct {
		Completed  string `json:"completed"`
		Processing string `json:"processing"`
		Failed     string `json:"failed"`
	} `json:"amount_by_status"`
}

// assertErrorBody verifies an error response matches the spec `Error` schema:
// a JSON object carrying the HTTP status as `code` and a non-empty `message`.
func assertErrorBody(t *testing.T, rec *httptest.ResponseRecorder, wantCode int) {
	t.Helper()
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Errorf("content-type = %q, want application/json", ct)
	}
	var body struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
	decode(t, rec, &body)
	if body.Code != wantCode {
		t.Errorf("body.code = %d, want %d", body.Code, wantCode)
	}
	if body.Message == "" {
		t.Error("expected a non-empty error message")
	}
}
