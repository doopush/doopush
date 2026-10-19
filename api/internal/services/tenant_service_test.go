package services

import (
	"errors"
	"testing"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTenantDB(t *testing.T) (*gorm.DB, models.App) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	if err := db.AutoMigrate(&models.App{}, &models.Device{}, &models.PushLog{}, &models.Tenant{}, &models.TenantDevice{}); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}
	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })

	app := models.App{Name: "Test", PackageName: "com.example.app", Platform: "both", Status: 1, AppKey: "dp_ak_test", TenantRegistration: true, TenantDailyQuota: 10}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	return db, app
}

func createTenantTestDevice(t *testing.T, db *gorm.DB, appID uint, token string) models.Device {
	t.Helper()
	device := models.Device{AppID: appID, Token: token, TokenHash: utils.HashString(token), Platform: "ios", Channel: "apns", PushEnv: "production", Status: 1}
	if err := db.Create(&device).Error; err != nil {
		t.Fatalf("create device: %v", err)
	}
	return device
}

func TestRegisterTenantRequiresRegistrationEnabled(t *testing.T) {
	db, app := setupTenantDB(t)
	if err := db.Model(&app).Update("tenant_registration", false).Error; err != nil {
		t.Fatal(err)
	}
	_, _, err := NewTenantService().RegisterTenant(app.ID, "DooTask", "", "1.1.1.1")
	if !errors.Is(err, ErrTenantRegistrationDisabled) {
		t.Fatalf("err = %v, want ErrTenantRegistrationDisabled", err)
	}
}

func TestRegisterTenantStoresHashAndLimitsPerIP(t *testing.T) {
	db, app := setupTenantDB(t)
	service := NewTenantService()
	tenant, plain, err := service.RegisterTenant(app.ID, " DooTask ", "https://a.example.com", "1.1.1.1")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if tenant.Name != "DooTask" || tenant.SecretHash != utils.HashCredential(plain) || tenant.SecretHash == plain {
		t.Fatalf("unexpected tenant: %+v", tenant)
	}
	if plain[:len(models.TenantSecretPrefix)] != models.TenantSecretPrefix {
		t.Fatalf("secret prefix = %q", plain)
	}
	// 删除的租户仍计入限额。
	if err := service.DeleteTenant(app.ID, tenant.ID); err != nil {
		t.Fatal(err)
	}
	for i := 1; i < TenantRegisterIPDailyLimit; i++ {
		if _, _, err := service.RegisterTenant(app.ID, "DooTask", "", "1.1.1.1"); err != nil {
			t.Fatalf("register #%d: %v", i, err)
		}
	}
	if _, _, err := service.RegisterTenant(app.ID, "DooTask", "", "1.1.1.1"); !errors.Is(err, ErrTenantRegisterRateLimited) {
		t.Fatalf("err = %v, want ErrTenantRegisterRateLimited", err)
	}
	if _, _, err := service.RegisterTenant(app.ID, "DooTask", "", "2.2.2.2"); err != nil {
		t.Fatalf("other ip should register: %v", err)
	}
	// 超过 24 小时的注册不再计入。
	if err := db.Unscoped().Model(&models.Tenant{}).Where("register_ip = ?", "1.1.1.1").
		Update("created_at", time.Now().Add(-25*time.Hour)).Error; err != nil {
		t.Fatal(err)
	}
	if _, _, err := service.RegisterTenant(app.ID, "DooTask", "", "1.1.1.1"); err != nil {
		t.Fatalf("register after window: %v", err)
	}
}

func TestAuthenticateTenant(t *testing.T) {
	db, app := setupTenantDB(t)
	service := NewTenantService()
	tenant, plain, err := service.RegisterTenant(app.ID, "DooTask", "", "1.1.1.1")
	if err != nil {
		t.Fatal(err)
	}
	if got, err := service.AuthenticateTenant(app.ID, plain); err != nil || got.ID != tenant.ID {
		t.Fatalf("authenticate = %v, %v", got, err)
	}
	if _, err := service.AuthenticateTenant(app.ID+1, plain); !errors.Is(err, ErrTenantInvalid) {
		t.Fatalf("other app err = %v", err)
	}
	if _, err := service.AuthenticateTenant(app.ID, "dp_as_whatever"); !errors.Is(err, ErrTenantInvalid) {
		t.Fatalf("app secret prefix err = %v", err)
	}
	if err := db.Model(&models.Tenant{}).Where("id = ?", tenant.ID).Update("status", 0).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := service.AuthenticateTenant(app.ID, plain); !errors.Is(err, ErrTenantDisabled) {
		t.Fatalf("disabled err = %v", err)
	}
	if err := service.DeleteTenant(app.ID, tenant.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.AuthenticateTenant(app.ID, plain); !errors.Is(err, ErrTenantInvalid) {
		t.Fatalf("deleted err = %v", err)
	}
}

func TestBindDeviceRebindsToLatestTenant(t *testing.T) {
	db, app := setupTenantDB(t)
	service := NewTenantService()
	first, _, _ := service.RegisterTenant(app.ID, "A", "", "1.1.1.1")
	second, _, _ := service.RegisterTenant(app.ID, "B", "", "1.1.1.1")
	device := createTenantTestDevice(t, db, app.ID, "token-1")

	if _, err := service.BindDevice(first, "unknown"); !errors.Is(err, ErrTenantDeviceNotFound) {
		t.Fatalf("unknown token err = %v", err)
	}
	got, err := service.BindDevice(first, "token-1")
	if err != nil || got.ID != device.ID {
		t.Fatalf("bind = %v, %v", got, err)
	}
	if bound, unbound, _ := service.SplitBoundDevices(first, []uint{device.ID}); len(bound) != 1 || len(unbound) != 0 {
		t.Fatalf("first split = %v / %v", bound, unbound)
	}
	if _, err := service.BindDevice(second, "token-1"); err != nil {
		t.Fatalf("rebind: %v", err)
	}
	var count int64
	db.Model(&models.TenantDevice{}).Where("device_id = ?", device.ID).Count(&count)
	if count != 1 {
		t.Fatalf("binding rows = %d, want 1", count)
	}
	if bound, unbound, _ := service.SplitBoundDevices(first, []uint{device.ID}); len(bound) != 0 || len(unbound) != 1 {
		t.Fatalf("first after rebind = %v / %v", bound, unbound)
	}
	// 其他租户解绑不影响当前归属。
	if err := service.UnbindDevice(first, device.ID); err != nil {
		t.Fatal(err)
	}
	if bound, _, _ := service.SplitBoundDevices(second, []uint{device.ID, device.ID, 0}); len(bound) != 1 {
		t.Fatalf("second split = %v", bound)
	}
	if err := service.UnbindDevice(second, device.ID); err != nil {
		t.Fatal(err)
	}
	if bound, _, _ := service.SplitBoundDevices(second, []uint{device.ID}); len(bound) != 0 {
		t.Fatalf("after unbind = %v", bound)
	}
}

func TestBindDeviceIsScopedToApp(t *testing.T) {
	db, app := setupTenantDB(t)
	other := models.App{Name: "Other", PackageName: "com.other", Platform: "ios", Status: 1, AppKey: "dp_ak_other"}
	if err := db.Create(&other).Error; err != nil {
		t.Fatal(err)
	}
	createTenantTestDevice(t, db, other.ID, "token-other")
	tenant, _, _ := NewTenantService().RegisterTenant(app.ID, "A", "", "1.1.1.1")
	if _, err := NewTenantService().BindDevice(tenant, "token-other"); !errors.Is(err, ErrTenantDeviceNotFound) {
		t.Fatalf("cross-app bind err = %v", err)
	}
}

func TestCheckQuota(t *testing.T) {
	db, app := setupTenantDB(t)
	service := NewTenantService()
	tenant, _, _ := service.RegisterTenant(app.ID, "A", "", "1.1.1.1")
	device := createTenantTestDevice(t, db, app.ID, "token-1")
	for i := 0; i < 8; i++ {
		db.Create(&models.PushLog{AppID: app.ID, DeviceID: device.ID, Title: "t", Content: "c", Payload: "{}", Channel: "apns", TenantID: &tenant.ID})
	}
	// 昨天的推送不计入今日用量。
	db.Create(&models.PushLog{AppID: app.ID, DeviceID: device.ID, Title: "t", Content: "c", Payload: "{}", Channel: "apns", TenantID: &tenant.ID, CreatedAt: time.Now().Add(-48 * time.Hour)})

	if err := service.CheckQuota(tenant, 2); err != nil {
		t.Fatalf("within app quota: %v", err)
	}
	if err := service.CheckQuota(tenant, 3); !errors.Is(err, ErrTenantQuotaExceeded) {
		t.Fatalf("over app quota err = %v", err)
	}
	quota := 20
	updated, _, err := service.UpdateTenant(app.ID, tenant.ID, nil, &quota)
	if err != nil || updated.DailyQuota != 20 {
		t.Fatalf("update tenant = %+v, %v", updated, err)
	}
	if err := service.CheckQuota(updated, 12); err != nil {
		t.Fatalf("within tenant quota: %v", err)
	}
	unlimited := 0
	if _, _, err := service.UpdateTenantSettings(app.ID, nil, &unlimited); err != nil {
		t.Fatal(err)
	}
	updated, _, _ = service.UpdateTenant(app.ID, tenant.ID, nil, &unlimited)
	if err := service.CheckQuota(updated, 1000); err != nil {
		t.Fatalf("unlimited: %v", err)
	}

	items, err := service.ListTenants(app.ID)
	if err != nil || len(items) != 1 || items[0].TodayPushCount != 8 {
		t.Fatalf("list = %+v, %v", items, err)
	}
}

func TestDeleteTenantRemovesBindings(t *testing.T) {
	db, app := setupTenantDB(t)
	service := NewTenantService()
	tenant, _, _ := service.RegisterTenant(app.ID, "A", "", "1.1.1.1")
	createTenantTestDevice(t, db, app.ID, "token-1")
	if _, err := service.BindDevice(tenant, "token-1"); err != nil {
		t.Fatal(err)
	}
	if err := service.DeleteTenant(app.ID+1, tenant.ID); !errors.Is(err, ErrTenantNotFound) {
		t.Fatalf("delete other app err = %v", err)
	}
	if err := service.DeleteTenant(app.ID, tenant.ID); err != nil {
		t.Fatal(err)
	}
	var count int64
	db.Model(&models.TenantDevice{}).Count(&count)
	if count != 0 {
		t.Fatalf("bindings left = %d", count)
	}
}
