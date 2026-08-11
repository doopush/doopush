package database

import (
	"strings"
	"testing"

	"github.com/doopush/doopush/api/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func openMigrationTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	return db
}

func TestPrepareAppKeyMigrationBackfillsExistingApps(t *testing.T) {
	db := openMigrationTestDB(t)
	if err := db.Exec("CREATE TABLE apps (id integer PRIMARY KEY, name text)").Error; err != nil {
		t.Fatalf("create legacy apps table: %v", err)
	}
	if err := db.Exec("INSERT INTO apps (id, name) VALUES (1, 'one'), (2, 'two')").Error; err != nil {
		t.Fatalf("insert legacy applications: %v", err)
	}

	if err := prepareAppKeyMigration(db); err != nil {
		t.Fatalf("prepareAppKeyMigration returned error: %v", err)
	}

	var rows []struct {
		ID     uint
		AppKey string
	}
	if err := db.Table("apps").Order("id").Find(&rows).Error; err != nil {
		t.Fatalf("read migrated applications: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("got %d applications, want 2", len(rows))
	}
	if !strings.HasPrefix(rows[0].AppKey, models.AppKeyPrefix) || !strings.HasPrefix(rows[1].AppKey, models.AppKeyPrefix) {
		t.Fatalf("backfilled keys do not use %q prefix: %#v", models.AppKeyPrefix, rows)
	}
	if rows[0].AppKey == rows[1].AppKey {
		t.Fatalf("backfilled keys must be unique: %q", rows[0].AppKey)
	}
}

func TestPrepareAppKeyMigrationResumesPartialMigration(t *testing.T) {
	db := openMigrationTestDB(t)
	if err := db.Exec("CREATE TABLE apps (id integer PRIMARY KEY, app_key varchar(80))").Error; err != nil {
		t.Fatalf("create partially migrated apps table: %v", err)
	}
	if err := db.Exec("INSERT INTO apps (id, app_key) VALUES (1, 'dp_ak_existing'), (2, '')").Error; err != nil {
		t.Fatalf("insert applications: %v", err)
	}

	if err := prepareAppKeyMigration(db); err != nil {
		t.Fatalf("prepareAppKeyMigration returned error: %v", err)
	}

	var keys []string
	if err := db.Table("apps").Order("id").Pluck("app_key", &keys).Error; err != nil {
		t.Fatalf("read migrated App Keys: %v", err)
	}
	if len(keys) != 2 || keys[0] != "dp_ak_existing" {
		t.Fatalf("existing App Key was changed: %#v", keys)
	}
	if !strings.HasPrefix(keys[1], models.AppKeyPrefix) || keys[1] == keys[0] {
		t.Fatalf("missing App Key was not safely backfilled: %#v", keys)
	}
}
