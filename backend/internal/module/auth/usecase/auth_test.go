package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// fakeUserRepo is an in-memory UserRepository for tests.
type fakeUserRepo struct {
	users map[string]*entity.User
}

func (f *fakeUserRepo) GetUserByEmail(_ context.Context, email string) (*entity.User, error) {
	u, ok := f.users[email]
	if !ok {
		return nil, entity.ErrorNotFound("user not found")
	}
	return u, nil
}

func newRepoWithUser(t *testing.T, email, password, role string) *fakeUserRepo {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	return &fakeUserRepo{users: map[string]*entity.User{
		email: {ID: "1", Email: email, PasswordHash: string(hash), Role: role},
	}}
}

func TestLogin_Success(t *testing.T) {
	secret := []byte("test-secret")
	repo := newRepoWithUser(t, "cs@test.com", "password", "cs")
	uc := NewAuthUsecase(repo, secret, time.Hour)

	token, user, err := uc.Login(context.Background(), "cs@test.com", "password")
	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if user.Role != "cs" {
		t.Errorf("expected role cs, got %q", user.Role)
	}

	// Token must be a valid JWT signed with the same secret.
	parsed, err := jwt.Parse(token, func(*jwt.Token) (any, error) { return secret, nil })
	if err != nil || !parsed.Valid {
		t.Fatalf("expected valid signed token, err=%v valid=%v", err, parsed.Valid)
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	repo := newRepoWithUser(t, "cs@test.com", "password", "cs")
	uc := NewAuthUsecase(repo, []byte("test-secret"), time.Hour)

	_, _, err := uc.Login(context.Background(), "cs@test.com", "nope")
	assertUnauthorized(t, err)
}

func TestLogin_UnknownUser(t *testing.T) {
	repo := newRepoWithUser(t, "cs@test.com", "password", "cs")
	uc := NewAuthUsecase(repo, []byte("test-secret"), time.Hour)

	// An unknown user must be reported as 401 (not 404) to avoid enumeration.
	_, _, err := uc.Login(context.Background(), "ghost@test.com", "password")
	assertUnauthorized(t, err)
}

func assertUnauthorized(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	var appErr *entity.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *entity.AppError, got %T", err)
	}
	if appErr.Code != entity.ErrorCodeUnauthorized {
		t.Errorf("expected unauthorized, got %q", appErr.Code)
	}
}
