package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/middleware"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTenantRouter(t *testing.T) (*gin.Engine, *gorm.DB, models.App) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.App{}, &models.Device{}, &models.PushLog{}, &models.Tenant{}, &models.TenantDevice{}); err != nil {
		t.Fatal(err)
	}
	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })

	app := models.App{Name: "Test", PackageName: "com.example.app", Platform: "both", Status: 1, AppKey: "dp_ak_test", TenantRegistration: true, TenantDailyQuota: 100}
	if err := db.Create(&app).Error; err != nil {
		t.Fatal(err)
	}

	ctrl := NewTenantController()
	r := gin.New()
	api := r.Group("/api/v1")
	api.POST("/apps/:appId/tenants", middleware.AppKeyAuth(), ctrl.Register)
	tenantRoutes := api.Group("", middleware.TenantAuth())
	tenantRoutes.POST("/apps/:appId/tenant/devices", ctrl.BindDevice)
	tenantRoutes.DELETE("/apps/:appId/tenant/devices/:deviceId", ctrl.UnbindDevice)
	tenantRoutes.POST("/apps/:appId/tenant/push", ctrl.Push)
	return r, db, app
}

func doTenantRequest(r *gin.Engine, method, path string, headers map[string]string, body interface{}) (int, map[string]interface{}) {
	var reader *bytes.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	return w.Code, resp
}

func TestTenantFlow(t *testing.T) {
	r, db, app := setupTenantRouter(t)
	base := "/api/v1/apps/" + strconv.Itoa(int(app.ID))

	if code, _ := doTenantRequest(r, "POST", base+"/tenants", map[string]string{"X-App-Key": "wrong"}, gin.H{"name": "DooTask"}); code != http.StatusUnauthorized {
		t.Fatalf("register with wrong app key = %d", code)
	}
	code, resp := doTenantRequest(r, "POST", base+"/tenants", map[string]string{"X-App-Key": app.AppKey}, gin.H{"name": "DooTask", "site_url": "https://a.example.com"})
	if code != http.StatusCreated {
		t.Fatalf("register = %d %v", code, resp)
	}
	secret := resp["data"].(map[string]interface{})["tenant_secret"].(string)
	auth := map[string]string{"Authorization": "Bearer " + secret}

	if code, _ := doTenantRequest(r, "POST", base+"/tenant/devices", map[string]string{"Authorization": "Bearer dp_ts_invalid"}, gin.H{"token": "x"}); code != http.StatusUnauthorized {
		t.Fatalf("invalid secret = %d", code)
	}

	// 已绑定设备在线（走网关），不产生离线推送；他人设备被忽略并返回。
	mine := models.Device{AppID: app.ID, Token: "token-mine", TokenHash: utils.HashString("token-mine"), Platform: "ios", Channel: "apns", PushEnv: "production", Status: 1, IsOnline: true}
	other := models.Device{AppID: app.ID, Token: "token-other", TokenHash: utils.HashString("token-other"), Platform: "ios", Channel: "apns", PushEnv: "production", Status: 1}
	db.Create(&mine)
	db.Create(&other)

	if code, _ := doTenantRequest(r, "POST", base+"/tenant/devices", auth, gin.H{"token": "nope"}); code != http.StatusNotFound {
		t.Fatalf("bind unknown = %d", code)
	}
	code, resp = doTenantRequest(r, "POST", base+"/tenant/devices", auth, gin.H{"token": "token-mine"})
	if code != http.StatusOK || uint(resp["data"].(map[string]interface{})["device_id"].(float64)) != mine.ID {
		t.Fatalf("bind = %d %v", code, resp)
	}

	code, resp = doTenantRequest(r, "POST", base+"/tenant/push", auth, gin.H{"title": "t", "content": "c", "device_ids": []uint{mine.ID, other.ID}})
	if code != http.StatusOK {
		t.Fatalf("push = %d %v", code, resp)
	}
	data := resp["data"].(map[string]interface{})
	unbound := data["unbound_device_ids"].([]interface{})
	if data["count"].(float64) != 0 || len(unbound) != 1 || uint(unbound[0].(float64)) != other.ID {
		t.Fatalf("push data = %v", data)
	}
	var logs int64
	db.Model(&models.PushLog{}).Count(&logs)
	if logs != 0 {
		t.Fatalf("push logs = %d, want 0", logs)
	}

	if code, _ := doTenantRequest(r, "POST", base+"/tenant/push", auth, gin.H{"title": "t", "content": "c", "device_ids": make([]uint, services.TenantPushMaxDevices+1)}); code != http.StatusBadRequest {
		t.Fatalf("too many devices = %d", code)
	}

	if code, _ := doTenantRequest(r, "DELETE", base+"/tenant/devices/"+strconv.Itoa(int(mine.ID)), auth, nil); code != http.StatusOK {
		t.Fatalf("unbind = %d", code)
	}

	db.Model(&models.Tenant{}).Where("1 = 1").Update("status", 0)
	if code, _ := doTenantRequest(r, "POST", base+"/tenant/push", auth, gin.H{"title": "t", "content": "c", "device_ids": []uint{mine.ID}}); code != http.StatusForbidden {
		t.Fatalf("disabled tenant = %d", code)
	}
}
