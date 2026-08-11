package utils

import (
	"strings"
	"testing"
)

func TestGenerateSecureToken(t *testing.T) {
	first := GenerateSecureToken("dp_test_")
	second := GenerateSecureToken("dp_test_")
	if !strings.HasPrefix(first, "dp_test_") || first == second {
		t.Fatalf("unexpected generated tokens: %q %q", first, second)
	}
	body := strings.TrimPrefix(first, "dp_test_")
	if len(body) != 32 {
		t.Fatalf("credential body must contain 32 characters: %q", first)
	}
	for _, char := range body {
		if !strings.ContainsRune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", char) {
			t.Fatalf("credential body contains an unsupported character: %q", first)
		}
	}
	if HashCredential(first) == HashCredential(second) {
		t.Fatal("different credentials must not share a hash")
	}
}
