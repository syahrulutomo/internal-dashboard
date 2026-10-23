package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
)

// fakeAuthUC is a hand-written double for authUsecase.AuthUsecase so the handler
// can be tested without a DB, cgo, or real crypto.
type fakeAuthUC struct {
	token       string
	user        *entity.User
	err         error
	gotEmail    string
	gotPassword string
}

func (f *fakeAuthUC) Login(_ context.Context, email, password string) (string, *entity.User, error) {
	f.gotEmail, f.gotPassword = email, password
	return f.token, f.user, f.err
}

func postLogin(h *AuthHandler, body string, nilBody bool) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/dashboard/v1/auth/login", strings.NewReader(body))
	if nilBody {
		req.Body = nil
	}
	rec := httptest.NewRecorder()
	h.PostDashboardV1AuthLogin(rec, req)
	return rec
}

func TestPostLogin_Success(t *testing.T) {
	uc := &fakeAuthUC{
		token: "signed.jwt.token",
		user:  &entity.User{Email: "cs@test.com", Role: entity.RoleCS},
	}
	rec := postLogin(NewAuthHandler(uc), `{"email":"cs@test.com","password":"password"}`, false)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	// Credentials must reach the usecase unchanged.
	if uc.gotEmail != "cs@test.com" || uc.gotPassword != "password" {
		t.Errorf("usecase got email=%q password=%q", uc.gotEmail, uc.gotPassword)
	}

	var body struct {
		Email string `json:"email"`
		Role  string `json:"role"`
		Token string `json:"token"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Email != "cs@test.com" || body.Role != entity.RoleCS || body.Token != "signed.jwt.token" {
		t.Errorf("unexpected body: %+v", body)
	}
}

func TestPostLogin_UsecaseErrorIsMappedToStatus(t *testing.T) {
	// A domain error from the usecase must be surfaced with its mapped HTTP
	// status and a spec-shaped body, not a 200.
	uc := &fakeAuthUC{err: entity.ErrorUnauthorized("invalid credentials")}
	rec := postLogin(NewAuthHandler(uc), `{"email":"cs@test.com","password":"nope"}`, false)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 (body: %s)", rec.Code, rec.Body.String())
	}
	var body struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Code != http.StatusUnauthorized || body.Message == "" {
		t.Errorf("unexpected error body: %+v", body)
	}
}

func TestPostLogin_BadRequestBodies(t *testing.T) {
	uc := &fakeAuthUC{token: "t", user: &entity.User{}}
	h := NewAuthHandler(uc)

	cases := []struct {
		name    string
		body    string
		nilBody bool
	}{
		{"malformed json", `{"email": "a",`, false},
		{"not an object", `"just a string"`, false},
		{"nil body", "", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := postLogin(h, tc.body, tc.nilBody)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400 (body: %s)", rec.Code, rec.Body.String())
			}
			// The usecase must not be reached when the body is rejected.
			if uc.gotEmail != "" {
				t.Errorf("usecase was called despite a bad body (email=%q)", uc.gotEmail)
			}
		})
	}
}
