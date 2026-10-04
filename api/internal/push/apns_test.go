package push

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"testing"
	"time"
)

func newTestP8Provider(t *testing.T) *APNsProvider {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	return &APNsProvider{authType: "p8", keyID: "KEYID", teamID: "TEAMID", privateKey: key}
}

func TestGenerateJWTReusesTokenWithinRefreshInterval(t *testing.T) {
	provider := newTestP8Provider(t)

	first, err := provider.generateJWT()
	if err != nil {
		t.Fatalf("generateJWT: %v", err)
	}
	second, err := provider.generateJWT()
	if err != nil {
		t.Fatalf("generateJWT: %v", err)
	}
	if first != second {
		t.Fatal("expected cached JWT to be reused within refresh interval")
	}
}

func TestGenerateJWTRefreshesAfterIntervalOrInvalidation(t *testing.T) {
	provider := newTestP8Provider(t)

	first, _ := provider.generateJWT()
	provider.jwtIssuedAt = time.Now().Add(-apnsJWTRefreshInterval)
	refreshed, _ := provider.generateJWT()
	if refreshed == first {
		t.Fatal("expected JWT to be regenerated after refresh interval")
	}

	provider.invalidateJWT()
	regenerated, _ := provider.generateJWT()
	if regenerated == refreshed {
		t.Fatal("expected JWT to be regenerated after invalidation")
	}
}
