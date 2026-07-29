package services

import (
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/pkg/utils"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func TestUpdateDeviceTokenUpdatesExistingDeviceRow(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("create sql mock: %v", err)
	}
	defer sqlDB.Close()

	db, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{SkipDefaultTransaction: true})
	if err != nil {
		t.Fatalf("open gorm: %v", err)
	}

	previousDB := database.DB
	database.DB = db
	defer func() { database.DB = previousDB }()

	now := time.Now()
	mock.ExpectQuery(regexp.QuoteMeta(
		"SELECT * FROM `devices` WHERE (id = ? AND app_id = ?) AND `devices`.`deleted_at` IS NULL ORDER BY `devices`.`id` LIMIT 1",
	)).WithArgs(uint(42), uint(7)).WillReturnRows(sqlmock.NewRows([]string{
		"id", "app_id", "token", "token_hash", "platform", "channel", "status", "created_at", "updated_at", "deleted_at",
	}).AddRow(42, 7, "old-token", utils.HashString("old-token"), "android", "fcm", 1, now, now, nil))

	mock.ExpectQuery("SELECT \\* FROM `devices` WHERE .*token_hash = \\?.*id <> \\?.*LIMIT 1").
		WithArgs(uint(7), utils.HashString("new-token"), uint(42)).
		WillReturnError(gorm.ErrRecordNotFound)

	mock.ExpectExec("UPDATE `devices` SET .*`token`=\\?.*`token_hash`=\\?.* WHERE `devices`.`deleted_at` IS NULL AND `id` = \\?").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := NewDeviceService().UpdateDeviceToken(7, 42, "new-token"); err != nil {
		t.Fatalf("update token: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}
