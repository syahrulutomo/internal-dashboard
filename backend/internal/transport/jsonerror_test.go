package transport

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
)

func TestCodeToStatus(t *testing.T) {
	cases := []struct {
		code entity.Code
		want int
	}{
		{entity.ErrorCodeBadRequest, http.StatusBadRequest},
		{entity.ErrorCodeUnauthorized, http.StatusUnauthorized},
		{entity.ErrorCodeNotFound, http.StatusNotFound},
		{entity.ErrorCodeInternal, http.StatusInternalServerError},
		{entity.Code("something_unknown"), http.StatusInternalServerError},
	}
	for _, tc := range cases {
		t.Run(string(tc.code), func(t *testing.T) {
			if got := CodeToStatus(tc.code); got != tc.want {
				t.Errorf("CodeToStatus(%q) = %d, want %d", tc.code, got, tc.want)
			}
		})
	}
}

// decodeBody unmarshals the recorded JSON response body into an ErrorResponse.
func decodeBody(t *testing.T, rec *httptest.ResponseRecorder) ErrorResponse {
	t.Helper()
	var resp ErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body.String(), err)
	}
	return resp
}

func TestWriteAppError(t *testing.T) {
	rec := httptest.NewRecorder()
	appErr := entity.ErrorNotFound("payment not found")
	appErr.Details = map[string]string{"id": "pay_123"}

	WriteAppError(rec, appErr)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("content-type = %q, want application/json", ct)
	}
	resp := decodeBody(t, rec)
	// The JSON `code` is the HTTP status, not the domain code string.
	if resp.Code != http.StatusNotFound {
		t.Errorf("body code = %d, want %d", resp.Code, http.StatusNotFound)
	}
	if resp.Message != "payment not found" {
		t.Errorf("body message = %q, want %q", resp.Message, "payment not found")
	}
	if resp.Details == nil {
		t.Error("expected details to be carried through, got nil")
	}
}

func TestWriteError_AppError(t *testing.T) {
	rec := httptest.NewRecorder()

	// A wrapped AppError must still be unwrapped by errors.As and mapped by code.
	wrapped := fmt.Errorf("layer context: %w", entity.ErrorBadRequest("invalid status"))
	WriteError(rec, wrapped)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	resp := decodeBody(t, rec)
	if resp.Code != http.StatusBadRequest {
		t.Errorf("body code = %d, want %d", resp.Code, http.StatusBadRequest)
	}
	if resp.Message != "invalid status" {
		t.Errorf("body message = %q, want %q", resp.Message, "invalid status")
	}
}

func TestWriteError_UnknownError(t *testing.T) {
	rec := httptest.NewRecorder()

	// A plain, non-AppError must not leak internals: generic 500 + "internal error".
	WriteError(rec, errors.New("database connection refused on 127.0.0.1:5432"))

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	resp := decodeBody(t, rec)
	if resp.Code != http.StatusInternalServerError {
		t.Errorf("body code = %d, want %d", resp.Code, http.StatusInternalServerError)
	}
	if resp.Message != "internal error" {
		t.Errorf("body message = %q, want %q (must not leak internals)", resp.Message, "internal error")
	}
}

func TestWriteError_NilError(t *testing.T) {
	rec := httptest.NewRecorder()

	WriteError(rec, nil)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if rec.Body.Len() != 0 {
		t.Errorf("expected empty body for nil error, got %q", rec.Body.String())
	}
}
