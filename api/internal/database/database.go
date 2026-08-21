package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/doopush/doopush/api/internal/config"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var DB *gorm.DB

const (
	connectMaxAttempts = 10
	connectRetryDelay  = 3 * time.Second
)

// Connect 连接数据库；MySQL 容器冷启动期间端口已开但服务未就绪，最多重试 10 次。
func Connect() {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		config.GetString("DB_USERNAME", "root"),
		config.GetString("DB_PASSWORD", "password"),
		config.GetString("DB_HOST", "mysql"),
		config.GetString("DB_PORT", "3306"),
		config.GetString("DB_DATABASE", "doopush"),
	)

	var (
		db    *gorm.DB
		sqlDB *sql.DB
		err   error
	)
	for attempt := 1; attempt <= connectMaxAttempts; attempt++ {
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
		if err == nil {
			if sqlDB, err = db.DB(); err == nil {
				if err = sqlDB.Ping(); err == nil {
					break
				}
			}
		}
		if attempt == connectMaxAttempts {
			log.Fatalf("数据库连接失败（已重试 %d 次）: %v", connectMaxAttempts, err)
		}
		log.Printf("数据库连接失败（第 %d/%d 次），%s 后重试: %v",
			attempt, connectMaxAttempts, connectRetryDelay, err)
		time.Sleep(connectRetryDelay)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	DB = db
	log.Println("数据库连接成功")
}

// AutoMigrate 自动迁移数据表
func AutoMigrate() {
	if err := prepareAppKeyMigration(DB); err != nil {
		log.Fatal("App Key迁移失败:", err)
	}

	// 执行自动迁移
	if err := DB.AutoMigrate(models.AllModels()...); err != nil {
		log.Fatal("数据库迁移失败:", err)
	}

	// 一次性清理 TCP 时代的死字段（GORM AutoMigrate 不会删列）
	_ = DB.Migrator().DropColumn(&models.Device{}, "gateway_node")
	_ = DB.Migrator().DropColumn(&models.Device{}, "connection_id")

	log.Println("数据库迁移完成")
}

// appKeyMigrationColumn deliberately omits NOT NULL and unique constraints.
// Existing rows must be populated before the App model applies those constraints.
type appKeyMigrationColumn struct {
	AppKey *string `gorm:"size:80;comment:客户端公开接入Key"`
}

func (appKeyMigrationColumn) TableName() string { return "apps" }

func prepareAppKeyMigration(db *gorm.DB) error {
	migrator := db.Migrator()
	if !migrator.HasTable(&models.App{}) {
		return nil
	}

	column := &appKeyMigrationColumn{}
	if !migrator.HasColumn(column, "AppKey") {
		if err := migrator.AddColumn(column, "AppKey"); err != nil {
			return fmt.Errorf("add nullable app_key column: %w", err)
		}
	}

	var appIDs []uint
	if err := db.Table("apps").
		Where("app_key IS NULL OR app_key = ?", "").
		Pluck("id", &appIDs).Error; err != nil {
		return fmt.Errorf("find applications missing app keys: %w", err)
	}

	for _, appID := range appIDs {
		appKey, err := generateUnusedAppKey(db)
		if err != nil {
			return fmt.Errorf("generate App Key for application %d: %w", appID, err)
		}
		if err := db.Table("apps").Where("id = ?", appID).Update("app_key", appKey).Error; err != nil {
			return fmt.Errorf("backfill App Key for application %d: %w", appID, err)
		}
	}

	return nil
}

func generateUnusedAppKey(db *gorm.DB) (string, error) {
	const maxAttempts = 10
	for attempt := 0; attempt < maxAttempts; attempt++ {
		appKey := utils.GenerateSecureToken(models.AppKeyPrefix)
		var count int64
		if err := db.Table("apps").Where("app_key = ?", appKey).Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return appKey, nil
		}
	}
	return "", fmt.Errorf("could not generate a unique App Key after %d attempts", maxAttempts)
}
