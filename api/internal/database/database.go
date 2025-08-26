package database

import (
	"fmt"
	"log"

	"github.com/doopush/doopush/api/internal/config"
	"github.com/doopush/doopush/api/internal/models"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var DB *gorm.DB

// Connect 连接数据库
func Connect() {
	// 构建数据库连接字符串
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		config.GetString("DB_USERNAME"),
		config.GetString("DB_PASSWORD"),
		config.GetString("DB_HOST"),
		config.GetString("DB_PORT"),
		config.GetString("DB_DATABASE"),
	)

	// 连接数据库
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("数据库连接失败:", err)
	}

	// 设置连接池
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("数据库配置失败:", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	DB = db
	log.Println("数据库连接成功")
}

// AutoMigrate 自动迁移数据表
func AutoMigrate() {
	// 执行自动迁移
	if err := DB.AutoMigrate(models.AllModels()...); err != nil {
		log.Fatal("数据库迁移失败:", err)
	}

	log.Println("数据库迁移完成")
}
