package models

import (
	"time"

	"gorm.io/gorm"
)

// Device 设备模型
type Device struct {
	ID            uint           `gorm:"primarykey" json:"id" example:"1"`
	AppID         uint           `gorm:"not null;index;comment:应用ID;uniqueIndex:idx_device_app_token" json:"app_id" binding:"required"`
	Token         string         `gorm:"size:500;not null;comment:设备推送Token" json:"token" example:"device_token_here" binding:"required"`
	TokenHash     string         `gorm:"size:64;index;not null;comment:Token哈希值;uniqueIndex:idx_device_app_token" json:"-"`
	Platform      string         `gorm:"size:20;not null;comment:设备平台" json:"platform" example:"ios" binding:"required,oneof=ios android"`
	Channel       string         `gorm:"size:20;not null;comment:推送通道" json:"channel" example:"apns" binding:"required"`
	Brand         string         `gorm:"size:50;comment:设备品牌" json:"brand" example:"Apple"`
	Model         string         `gorm:"size:100;comment:设备型号" json:"model" example:"iPhone 14"`
	SystemVer     string         `gorm:"size:50;comment:系统版本" json:"system_version" example:"17.0"`
	AppVersion    string         `gorm:"size:50;comment:应用版本" json:"app_version" example:"1.0.0"`
	UserAgent     string         `gorm:"size:500;comment:用户代理" json:"user_agent"`
	Status        int            `gorm:"default:1;comment:设备状态 1=正常 0=禁用" json:"status" example:"1"`
	IsOnline      bool           `gorm:"default:false;comment:实时在线状态" json:"is_online"`
	LastSeen      *time.Time     `gorm:"comment:最后活跃时间" json:"last_seen"`
	LastHeartbeat *time.Time     `gorm:"comment:最后心跳时间" json:"last_heartbeat"`
	GatewayNode   string         `gorm:"size:64;comment:所在网关节点" json:"gateway_node"`
	ConnectionID  string         `gorm:"size:128;comment:连接标识" json:"connection_id"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App       App              `gorm:"foreignKey:AppID" json:"app,omitempty"`
	PushLogs  []PushLog        `gorm:"foreignKey:DeviceID" json:"push_logs,omitempty"`
	TagMaps   []DeviceTagMap   `gorm:"foreignKey:DeviceID" json:"tag_maps,omitempty"`
	GroupMaps []DeviceGroupMap `gorm:"foreignKey:DeviceID" json:"group_maps,omitempty"`
}

// DeviceTagMap 设备标签映射
type DeviceTagMap struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	DeviceID  uint      `gorm:"not null;comment:设备ID" json:"device_id" binding:"required"`
	TagID     uint      `gorm:"not null;comment:标签ID" json:"tag_id" binding:"required"`
	CreatedAt time.Time `json:"created_at"`

	// 关联关系
	Device Device    `gorm:"foreignKey:DeviceID" json:"device,omitempty"`
	Tag    DeviceTag `gorm:"foreignKey:TagID" json:"tag,omitempty"`
}

// DeviceGroupMap 设备分组映射
type DeviceGroupMap struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	DeviceID  uint      `gorm:"not null;comment:设备ID" json:"device_id" binding:"required"`
	GroupID   uint      `gorm:"not null;comment:分组ID" json:"group_id" binding:"required"`
	CreatedAt time.Time `json:"created_at"`

	// 关联关系
	Device Device      `gorm:"foreignKey:DeviceID" json:"device,omitempty"`
	Group  DeviceGroup `gorm:"foreignKey:GroupID" json:"group,omitempty"`
}

// TableName 设置表名
func (Device) TableName() string {
	return "devices"
}

// TableName 设置表名
func (DeviceTagMap) TableName() string {
	return "device_tag_maps"
}

// TableName 设置表名
func (DeviceGroupMap) TableName() string {
	return "device_group_maps"
}
