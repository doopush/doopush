package services

import (
	"testing"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestGetUserActivityStatsExcludesMachinePrincipals(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	if err := db.Exec(`CREATE TABLE audit_logs (
		id integer PRIMARY KEY,
		app_id integer NOT NULL,
		user_id integer,
		user_name text,
		principal_type text NOT NULL,
		created_at datetime NOT NULL
	)`).Error; err != nil {
		t.Fatalf("create audit_logs table: %v", err)
	}

	now := time.Now()
	if err := db.Exec(
		"INSERT INTO audit_logs (app_id, user_id, user_name, principal_type, created_at) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
		1, 7, "alice", "user", now,
		1, nil, "", "app_secret", now,
	).Error; err != nil {
		t.Fatalf("insert audit logs: %v", err)
	}

	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })

	appID := uint(1)
	var count int64
	if err := userActivityQuery(&appID, 1).Count(&count).Error; err != nil {
		t.Fatalf("count filtered user activity: %v", err)
	}
	if count != 1 {
		t.Fatalf("filtered user activity count = %d, want 1", count)
	}
}
