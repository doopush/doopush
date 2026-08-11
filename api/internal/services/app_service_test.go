package services

import "testing"

func TestIsValidAppRole(t *testing.T) {
	tests := []struct {
		role string
		want bool
	}{
		{role: "owner", want: true},
		{role: "developer", want: true},
		{role: "viewer", want: true},
		{role: "admin", want: false},
		{role: "", want: false},
	}

	for _, test := range tests {
		t.Run(test.role, func(t *testing.T) {
			if got := isValidAppRole(test.role); got != test.want {
				t.Fatalf("isValidAppRole(%q) = %v, want %v", test.role, got, test.want)
			}
		})
	}
}
