package entity

import "testing"

func TestPaymentStatus_IsValid(t *testing.T) {
	valid := []PaymentStatus{
		PaymentStatusCompleted,
		PaymentStatusProcessing,
		PaymentStatusFailed,
	}
	for _, s := range valid {
		if !s.IsValid() {
			t.Errorf("IsValid(%q) = false, want true", s)
		}
	}

	invalid := []PaymentStatus{"", "refunded", "COMPLETED", "pending"}
	for _, s := range invalid {
		if s.IsValid() {
			t.Errorf("IsValid(%q) = true, want false", s)
		}
	}
}
