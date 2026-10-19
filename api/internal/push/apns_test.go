package push

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"strconv"
	"testing"
	"time"

	"golang.org/x/net/http2"

	"github.com/doopush/doopush/api/internal/models"
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

func TestBuildAPNsPayloadAppliesAPNsOptionsToAps(t *testing.T) {
	pushLog := &models.PushLog{
		Title:   "Permission",
		Content: "Bash",
		Payload: `{"action":"open_page","data":"{}","apns":{"category":"happy.permission","thread_id":"session-1"},"oppo":{"category":"IM"}}`,
	}

	payload := buildAPNsPayload(pushLog)

	aps, ok := payload["aps"].(map[string]interface{})
	if !ok {
		t.Fatal("expected aps dictionary")
	}
	if aps["category"] != "happy.permission" {
		t.Fatalf("expected aps.category, got %v", aps["category"])
	}
	if aps["thread-id"] != "session-1" {
		t.Fatalf("expected aps.thread-id, got %v", aps["thread-id"])
	}
	if _, exists := payload["apns"]; exists {
		t.Fatal("expected apns options to stay out of the root dictionary")
	}
	if payload["action"] != "open_page" || payload["data"] != "{}" {
		t.Fatal("expected custom data to stay at the root")
	}
}

func TestBuildAPNsPayloadWithoutAPNsOptionsHasNoCategory(t *testing.T) {
	payload := buildAPNsPayload(&models.PushLog{Title: "T", Content: "C", Payload: `{"apns":"invalid"}`})

	aps := payload["aps"].(map[string]interface{})
	if _, exists := aps["category"]; exists {
		t.Fatal("expected no category")
	}
}

func newTestP8PEM(t *testing.T) string {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatalf("marshal key: %v", err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
}

func TestAPNsEnvironmentFollowsDeviceAndIgnoresConfig(t *testing.T) {
	keyPEM := newTestP8PEM(t)
	for _, stored := range []string{`"production":false,"environment":"development"`, `"production":true,"environment":"production"`, `"_":0`} {
		for _, env := range []string{"development", "production"} {
			// 控制台旧配置中的 production/environment 字段不再影响网关选择
			var config APNsConfig
			raw := `{` + stored + `,"bundle_id":"com.example","key_id":"KEYID","team_id":"TEAMID","private_key":` + strconv.Quote(keyPEM) + `}`
			if err := json.Unmarshal([]byte(raw), &config); err != nil {
				t.Fatalf("unmarshal config: %v", err)
			}
			config.Environment = env
			provider, err := NewAPNsProviderWithConfig(config)
			if err != nil {
				t.Fatalf("create provider: %v", err)
			}
			if provider.environment != env {
				t.Fatalf("stored %s, device %s: got environment %s", stored, env, provider.environment)
			}
			if host := provider.client.Transport.(*http2.Transport).TLSClientConfig.ServerName; host != getAPNsHost(env) {
				t.Fatalf("stored %s, device %s: got host %s", stored, env, host)
			}
		}
	}
}

func TestAPNsEnvironmentDefaultsToProduction(t *testing.T) {
	for _, env := range []string{"", "staging"} {
		config := APNsConfig{Environment: env}
		normalizeConfig(&config)
		if config.Environment != "production" {
			t.Fatalf("env %q: got %s", env, config.Environment)
		}
	}
}
