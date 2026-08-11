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
	AppKey      string         `gorm:"size:80;not null;uniqueIndex;comment:客户端公开接入Key" json:"app_key" example:"dp_ak_xxx"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Role        string         `gorm:"column:role;->;-:migration" json:"role,omitempty"`

	// 关联关系
	AppSecrets      []AppSecret         `gorm:"foreignKey:AppID" json:"app_secrets,omitempty"`
	Devices         []Device            `gorm:"foreignKey:AppID" json:"devices,omitempty"`
	UserPermissions []UserAppPermission `gorm:"foreignKey:AppID" json:"user_permissions,omitempty"`
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
func (AppConfig) TableName() string {
	return "app_configs"
}
