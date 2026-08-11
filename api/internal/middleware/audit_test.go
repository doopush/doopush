package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestParseActionFromRequestAppSecretUpdate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest("PATCH", "/api/v1/apps/12/app-secrets/34", nil)

	action, resource, resourceID := parseActionFromRequest(context)
	if action != "update" || resource != "app_secret" || resourceID != "34" {
		t.Fatalf("parseActionFromRequest() = (%q, %q, %q), want (%q, %q, %q)", action, resource, resourceID, "update", "app_secret", "34")
	}
}

func TestParseActionFromRequestAppSecretCreateDoesNotUseAppID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest("POST", "/api/v1/apps/12/app-secrets", nil)

	action, resource, resourceID := parseActionFromRequest(context)
	if action != "create" || resource != "app_secret" || resourceID != "" {
		t.Fatalf("parseActionFromRequest() = (%q, %q, %q), want (%q, %q, %q)", action, resource, resourceID, "create", "app_secret", "")
	}
}

func TestResolveAuditResourceIDUsesCreatedResource(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Set("audit_resource_id", uint(34))

	if resourceID := resolveAuditResourceID(context, "12"); resourceID != "34" {
		t.Fatalf("resolveAuditResourceID() = %q, want %q", resourceID, "34")
	}
}
