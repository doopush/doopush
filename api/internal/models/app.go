package models

import (
	"time"

	"gorm.io/gorm"
)

// App 应用模型
type App struct {
	ID          uint           `gorm:"primarykey" json:"id" example:"1"`
	Name        string         `gorm:"size:100;not null" json:"name" example:"我的应用" binding:"required"`
	PackageName string         `gorm:"size:100;not null" json:"package_name" example:"com.example.app" binding:"required"`
	Description string         `gorm:"size:500" json:"description" example:"应用描述"`
	Platform    string         `gorm:"size:20;not null;comment:平台类型" json:"platform" example:"both" binding:"required,oneof=ios android both"`
	AppIcon     string         `gorm:"size:255;comment:应用图标URL" json:"app_icon" example:"/uploads/icons/app_123.png"`
	Status      int            `gorm:"default:1;comment:应用状态 1=正常 0=禁用" json:"status" example:"1"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	APIKeys         []AppAPIKey         `gorm:"foreignKey:AppID" json:"api_keys,omitempty"`
	Devices         []Device            `gorm:"foreignKey:AppID" json:"devices,omitempty"`
	UserPermissions []UserAppPermission `gorm:"foreignKey:AppID" json:"user_permissions,omitempty"`
}

// AppAPIKey 应用API密钥模型
type AppAPIKey struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	AppID     uint           `gorm:"not null;comment:应用ID" json:"app_id" binding:"required"`
	Name      string         `gorm:"size:100;not null" json:"name" example:"生产环境密钥" binding:"required"`
	KeyHash   string         `gorm:"size:64;uniqueIndex;not null;comment:API密钥哈希" json:"-"`
	KeyPrefix string         `gorm:"size:10;not null;comment:密钥前缀" json:"key_prefix" example:"dp_live_"`
	KeySuffix string         `gorm:"size:8;not null;comment:密钥后缀" json:"key_suffix" example:"1a2b3c4d"`
	Status    int            `gorm:"default:1;comment:密钥状态 1=启用 0=禁用" json:"status" example:"1"`
	LastUsed  *time.Time     `gorm:"comment:最后使用时间" json:"last_used"`
	ExpiresAt *time.Time     `gorm:"comment:过期时间" json:"expires_at"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App App `gorm:"foreignKey:AppID" json:"app,omitempty"`
}

// AppConfig 应用推送配置模型
type AppConfig struct {
	ID       uint   `gorm:"primarykey" json:"id"`
	AppID    uint   `gorm:"not null;comment:应用ID" json:"app_id" binding:"required"`
	Platform string `gorm:"size:20;not null;comment:平台类型" json:"platform" example:"ios" binding:"required,oneof=ios android"`
	Channel  string `gorm:"size:20;not null;comment:推送通道" json:"channel" example:"apns" binding:"required"`
	Config   string `gorm:"type:json;comment:推送配置JSON" json:"config" example:"{\"cert_path\":\"/path/to/cert.p12\"}"`
	Status   int    `gorm:"default:1;comment:配置状态 1=启用 0=禁用" json:"status" example:"1"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App App `gorm:"foreignKey:AppID" json:"app,omitempty"`
}

// TableName 设置表名
func (App) TableName() string {
	return "apps"
}

// TableName 设置表名
func (AppAPIKey) TableName() string {
	return "app_api_keys"
}

// TableName 设置表名
func (AppConfig) TableName() string {
	return "app_configs"
}
