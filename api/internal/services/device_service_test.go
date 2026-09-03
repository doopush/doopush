package services

import (
	"testing"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestRegisterDeviceRestoresSoftDeletedDevice(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	if err := db.AutoMigrate(&models.App{}, &models.Device{}); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}

	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })

	app := models.App{
		Name:        "Test App",
		PackageName: "com.example.app",
		Platform:    "ios",
		Status:      1,
		AppKey:      "dp_ak_test",
	}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}

	service := NewDeviceService()
	registered, err := service.RegisterDevice(
		app.ID,
		"device-token",
		app.PackageName,
		"ios",
		"apns",
		"production",
		"Apple",
		"iPhone",
		"18.0",
		"1.0.0",
		"TestApp/1.0.0",
	)
	if err != nil {
		t.Fatalf("register device: %v", err)
	}
	if err := db.Delete(registered).Error; err != nil {
		t.Fatalf("soft delete device: %v", err)
	}

	restored, err := service.RegisterDevice(
		app.ID,
		"device-token",
		app.PackageName,
		"ios",
		"apns",
		"production",
		"Apple",
		"iPhone 16",
		"18.1",
		"1.1.0",
		"TestApp/1.1.0",
	)
	if err != nil {
		t.Fatalf("restore device: %v", err)
	}

	if restored.ID != registered.ID {
		t.Fatalf("restored device ID = %d, want %d", restored.ID, registered.ID)
	}
	if restored.DeletedAt.Valid {
		t.Fatal("restored device is still soft deleted")
	}
	if restored.Model != "iPhone 16" || restored.AppVersion != "1.1.0" {
		t.Fatalf("restored device metadata was not refreshed: %#v", restored)
	}

	var count int64
	if err := db.Unscoped().Model(&models.Device{}).
		Where("app_id = ? AND token_hash = ?", app.ID, registered.TokenHash).
		Count(&count).Error; err != nil {
		t.Fatalf("count device rows: %v", err)
	}
	if count != 1 {
		t.Fatalf("device row count = %d, want 1", count)
	}
}
