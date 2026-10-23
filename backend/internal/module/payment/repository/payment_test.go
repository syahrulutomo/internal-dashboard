package repository

import (
	"reflect"
	"testing"

	"github.com/durianpay/fullstack-boilerplate/internal/entity"
)

func TestBuildOrderBy(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"empty defaults to newest first", "", "created_at DESC"},
		{"single asc", "amount", "amount_cents ASC"},
		{"single desc", "-created_at", "created_at DESC"},
		{"multiple fields", "-amount,merchant", "amount_cents DESC, merchant ASC"},
		{"unknown field ignored", "password", "created_at DESC"},
		{"injection attempt is dropped", "amount; DROP TABLE payments", "created_at DESC"},
		{"mix of valid and invalid", "status,evil", "status ASC"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := buildOrderBy(tc.in); got != tc.want {
				t.Errorf("buildOrderBy(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestBuildWhere(t *testing.T) {
	cases := []struct {
		name       string
		filter     entity.PaymentFilter
		wantClause string
		wantArgs   []any
	}{
		{
			name:       "no filter",
			filter:     entity.PaymentFilter{},
			wantClause: "",
			wantArgs:   nil,
		},
		{
			name:       "status only",
			filter:     entity.PaymentFilter{Status: "failed"},
			wantClause: " WHERE status = ?",
			wantArgs:   []any{"failed"},
		},
		{
			name:       "search matches id or merchant",
			filter:     entity.PaymentFilter{Search: "arun"},
			wantClause: ` WHERE (id LIKE ? ESCAPE '\' OR merchant LIKE ? ESCAPE '\')`,
			wantArgs:   []any{"%arun%", "%arun%"},
		},
		{
			name:       "search escapes LIKE metacharacters",
			filter:     entity.PaymentFilter{Search: "100%_x"},
			wantClause: ` WHERE (id LIKE ? ESCAPE '\' OR merchant LIKE ? ESCAPE '\')`,
			wantArgs:   []any{`%100\%\_x%`, `%100\%\_x%`},
		},
		{
			name:       "status and search combine with AND",
			filter:     entity.PaymentFilter{Status: "completed", Search: "batik"},
			wantClause: ` WHERE status = ? AND (id LIKE ? ESCAPE '\' OR merchant LIKE ? ESCAPE '\')`,
			wantArgs:   []any{"completed", "%batik%", "%batik%"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotClause, gotArgs := buildWhere(tc.filter)
			if gotClause != tc.wantClause {
				t.Errorf("clause = %q, want %q", gotClause, tc.wantClause)
			}
			if !reflect.DeepEqual(gotArgs, tc.wantArgs) {
				t.Errorf("args = %#v, want %#v", gotArgs, tc.wantArgs)
			}
		})
	}
}

func TestEscapeLike(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"plain", "plain"},
		{"50%", `50\%`},
		{"a_b", `a\_b`},
		{`back\slash`, `back\\slash`},
		{`%_\`, `\%\_\\`},
	}
	for _, tc := range cases {
		if got := escapeLike(tc.in); got != tc.want {
			t.Errorf("escapeLike(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
