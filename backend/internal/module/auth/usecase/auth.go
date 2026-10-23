package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
	"github.com/durianpay/fullstack-boilerplate/internal/module/auth/repository"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthUsecase interface {
	Login(ctx context.Context, email string, password string) (string, *entity.User, error)
}

type Auth struct {
	repo      repository.UserRepository
	jwtSecret []byte
	ttl       time.Duration
}

func NewAuthUsecase(repo repository.UserRepository, jwtSecret []byte, ttl time.Duration) *Auth {
	return &Auth{repo: repo, jwtSecret: jwtSecret, ttl: ttl}
}

// Login verifies email + password and returns a JWT.
func (a *Auth) Login(ctx context.Context, email string, password string) (string, *entity.User, error) {
	user, err := a.repo.GetUserByEmail(ctx, email)
	if err != nil {
		// Treat an unknown user as invalid credentials (401) rather than 404 to
		// match the login contract and avoid user enumeration. Genuine internal
		// errors still propagate as 500.
		var appErr *entity.AppError
		if errors.As(err, &appErr) && appErr.Code == entity.ErrorCodeNotFound {
			return "", nil, entity.ErrorUnauthorized("invalid credentials")
		}
		return "", nil, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", nil, entity.WrapError(err, entity.ErrorCodeUnauthorized, "invalid credentials")
	}

	// Carry the user's identity and role in the token so downstream services
	// can authorize without a second DB lookup. These are signed, so a client
	// cannot tamper with its own role.
	claims := jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"role":  user.Role,
		"exp":   time.Now().Add(a.ttl).Unix(),
		"iat":   time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(a.jwtSecret)
	if err != nil {
		return "", nil, entity.WrapError(err, entity.ErrorCodeUnauthorized, "invalid credentials")
	}
	return signed, user, nil
}
