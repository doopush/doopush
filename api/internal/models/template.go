package models

import (
	"time"

	"gorm.io/gorm"
)

// MessageTemplate 消息模板模型
type MessageTemplate struct {
	ID        uint           `gorm:"primarykey" json:"id" example:"1"`
	AppID     uint           `gorm:"not null;index;comment:应用ID" json:"app_id" binding:"required"`
	Name      string         `gorm:"size:100;not null;comment:模板名称" json:"name" example:"欢迎消息" binding:"required"`
	Title     string         `gorm:"size:200;not null;comment:推送标题模板" json:"title" example:"欢迎使用{{username}}" binding:"required"`
	Content   string         `gorm:"type:text;not null;comment:推送内容模板" json:"content" example:"亲爱的{{username}}，欢迎使用我们的应用！" binding:"required"`
	Variables string         `gorm:"type:json;comment:可用变量定义" json:"variables" example:"{\"username\":{\"type\":\"string\",\"description\":\"用户名\"}}"`
	Platform  string         `gorm:"size:20;comment:适用平台" json:"platform" example:"all"`
	Locale    string         `gorm:"size:10;default:zh-CN;comment:语言代码" json:"locale" example:"zh-CN"`
	Version   int            `gorm:"default:1;comment:模板版本" json:"version" example:"1"`
	IsActive  bool           `gorm:"default:true;comment:是否激活" json:"is_active" example:"true"`
	CreatedBy uint           `gorm:"not null;comment:创建者ID" json:"created_by"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App App `gorm:"foreignKey:AppID" json:"app,omitempty"`
}

// UserTag 用户标签关联模型 (符合需求文档中的user_tags表)
type UserTag struct {
	ID        uint      `gorm:"primarykey" json:"id" example:"1"`
	AppID     uint      `gorm:"not null;index;comment:应用ID" json:"app_id" binding:"required"`
	UserID    string    `gorm:"size:100;not null;index;comment:应用内用户ID" json:"user_id" example:"user123" binding:"required"`
	TagName   string    `gorm:"size:100;not null;index;comment:标签名称" json:"tag_name" example:"vip_level" binding:"required"`
	TagValue  string    `gorm:"size:200;comment:标签值" json:"tag_value" example:"gold"`
	CreatedAt time.Time `json:"created_at"`

	// 关联关系
	App App `gorm:"foreignKey:AppID" json:"app,omitempty"`
}

// TagDefinition 标签定义模型 (用于管理标签类型)
type TagDefinition struct {
	ID          uint           `gorm:"primarykey" json:"id" example:"1"`
	AppID       uint           `gorm:"not null;index;comment:应用ID" json:"app_id" binding:"required"`
	Name        string         `gorm:"size:50;not null;comment:标签名称" json:"name" example:"VIP用户" binding:"required"`
	Description string         `gorm:"size:200;comment:标签描述" json:"description" example:"VIP用户标签"`
	Color       string         `gorm:"size:7;default:#007bff;comment:标签颜色" json:"color" example:"#007bff"`
	Status      int            `gorm:"default:1;comment:标签状态 1=启用 0=禁用" json:"status" example:"1"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App App `gorm:"foreignKey:AppID" json:"app,omitempty"`
}

// DeviceGroup 设备分组模型
type DeviceGroup struct {
	ID          uint           `gorm:"primarykey" json:"id" example:"1"`
	AppID       uint           `gorm:"not null;index;comment:应用ID" json:"app_id" binding:"required"`
	Name        string         `gorm:"size:100;not null;comment:分组名称" json:"name" example:"测试用户组" binding:"required"`
	Description string         `gorm:"size:500;comment:分组描述" json:"description" example:"用于测试的用户分组"`
	Conditions  string         `gorm:"type:json;comment:分组条件" json:"conditions" example:"{\"platform\":\"ios\",\"app_version\":\">=1.0.0\"}"`
	Status      int            `gorm:"default:1;comment:分组状态 1=启用 0=禁用" json:"status" example:"1"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App        App              `gorm:"foreignKey:AppID" json:"app,omitempty"`
	DeviceMaps []DeviceGroupMap `gorm:"foreignKey:GroupID" json:"device_maps,omitempty"`
}

// TableName 设置表名
func (MessageTemplate) TableName() string {
	return "message_templates"
}

// TableName 设置表名
func (UserTag) TableName() string {
	return "user_tags"
}

// TableName 设置表名
func (DeviceGroup) TableName() string {
	return "device_groups"
}
