package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
	mw "github.com/durianpay/fullstack-boilerplate/internal/middleware"
	authUsecase "github.com/durianpay/fullstack-boilerplate/internal/module/auth/usecase"
	"github.com/durianpay/fullstack-boilerplate/internal/openapigen"
	"github.com/durianpay/fullstack-boilerplate/internal/transport"
)

type AuthHandler struct {
	authUC authUsecase.AuthUsecase
}

func NewAuthHandler(authUC authUsecase.AuthUsecase) *AuthHandler {
	return &AuthHandler{
		authUC: authUC,
	}
}

func (a *AuthHandler) PostDashboardV1AuthLogin(w http.ResponseWriter, r *http.Request) {
	var req openapigen.PostDashboardV1AuthLoginJSONBody
	if !decodeJSONBody(w, r, &req) {
		return
	}
	token, user, err := a.authUC.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		transport.WriteError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	err = json.NewEncoder(w).Encode(openapigen.LoginResponse{Email: &user.Email, Role: &user.Role, Token: &token})
	if err != nil {
		transport.WriteAppError(w, entity.ErrorInternal("internal server error"))
		return
	}
}

// GetDashboardV1AuthMe handles GET /dashboard/v1/auth/me. It returns the
// caller's identity (email + role) taken from the verified JWT claims injected
// by the WithClaims middleware — no DB lookup, no token echoed back. The route
// declares bearerAuth, so the validator rejects unauthenticated callers with a
// 401 before this runs; the absent-claims branch is defensive, failing closed.
func (a *AuthHandler) GetDashboardV1AuthMe(w http.ResponseWriter, r *http.Request) {
	claims, ok := mw.ClaimsFromContext(r.Context())
	if !ok {
		transport.WriteAppError(w, entity.ErrorUnauthorized("missing or invalid token"))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	err := json.NewEncoder(w).Encode(openapigen.UserInfo{Email: claims.Email, Role: claims.Role})
	if err != nil {
		transport.WriteAppError(w, entity.ErrorInternal("internal server error"))
		return
	}
}

func decodeJSONBody(w http.ResponseWriter, r *http.Request, dst any) bool {
	if r.Body == nil {
		transport.WriteAppError(w, entity.ErrorBadRequest("empty body"))
		return false
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		transport.WriteAppError(w, entity.ErrorBadRequest("failed to read body"))
		return false
	}

	if err := json.Unmarshal(body, dst); err != nil {
		transport.WriteAppError(w, entity.ErrorBadRequest("invalid json: "+err.Error()))
		return false
	}
	return true
}
