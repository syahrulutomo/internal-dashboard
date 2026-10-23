package entity

import (
	"errors"
	"testing"
)

func TestErrorConstructors(t *testing.T) {
	cases := []struct {
		name string
		err  *AppError
		code Code
	}{
		{"not found", ErrorNotFound("x"), ErrorCodeNotFound},
		{"unauthorized", ErrorUnauthorized("x"), ErrorCodeUnauthorized},
		{"forbidden", ErrorForbidden("x"), ErrorCodeForbidden},
		{"internal", ErrorInternal("x"), ErrorCodeInternal},
		{"bad request", ErrorBadRequest("x"), ErrorCodeBadRequest},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.err.Code != tc.code {
				t.Errorf("Code = %q, want %q", tc.err.Code, tc.code)
			}
			if tc.err.Message != "x" {
				t.Errorf("Message = %q, want %q", tc.err.Message, "x")
			}
		})
	}
}

func TestAppError_Error(t *testing.T) {
	t.Run("without a wrapped error returns the message", func(t *testing.T) {
		e := NewError(ErrorCodeBadRequest, "bad input")
		if got := e.Error(); got != "bad input" {
			t.Errorf("Error() = %q, want %q", got, "bad input")
		}
	})

	t.Run("with a wrapped error includes the cause", func(t *testing.T) {
		cause := errors.New("boom")
		e := &AppError{Code: ErrorCodeInternal, Message: "db error", Err: cause}
		if got := e.Error(); got != "db error: boom" {
			t.Errorf("Error() = %q, want %q", got, "db error: boom")
		}
	})
}

func TestWrapError(t *testing.T) {
	t.Run("wraps a plain error with the given code and preserves the cause", func(t *testing.T) {
		cause := errors.New("boom")
		e := WrapError(cause, ErrorCodeInternal, "db error")
		if e.Code != ErrorCodeInternal || e.Message != "db error" {
			t.Errorf("got code=%q message=%q", e.Code, e.Message)
		}
		if !errors.Is(e.Err, cause) {
			t.Errorf("wrapped cause not preserved: %v", e.Err)
		}
	})

	t.Run("preserves an existing AppError's code rather than overriding it", func(t *testing.T) {
		// A not_found passed through WrapError must stay not_found so the HTTP
		// status mapping at the boundary is correct (see auth usecase login).
		orig := ErrorNotFound("user not found")
		e := WrapError(orig, ErrorCodeInternal, "ignored message")
		if e.Code != ErrorCodeNotFound {
			t.Errorf("Code = %q, want %q (original must win)", e.Code, ErrorCodeNotFound)
		}
		if e.Message != "user not found" {
			t.Errorf("Message = %q, want original", e.Message)
		}
	})
}
