package models

import (
	"time"

	"gorm.io/gorm"
)

// TenantSecretPrefix 租户密钥前缀，与 App Secret 区分，只能用于租户接口。
const TenantSecretPrefix = "dp_ts_"

// Tenant 应用下自助注册的接入方（如私有部署的业务服务器）。
// 租户只持有自己的密钥，且只能向绑定到自己的设备推送，用于在不下发 App Secret 的前提下共享同一个客户端应用。
type Tenant struct {
	ID         uint           `gorm:"primarykey" json:"id"`
	AppID      uint           `gorm:"not null;index;comment:应用ID" json:"app_id"`
	Name       string         `gorm:"size:100;not null;comment:租户名称（自报，仅展示）" json:"name"`
	SiteURL    string         `gorm:"size:255;comment:站点地址（自报，仅展示）" json:"site_url"`
	SecretHash string         `gorm:"size:64;uniqueIndex;not null" json:"-"`
	Suffix     string         `gorm:"size:8;not null" json:"suffix"`
	Status     int            `gorm:"not null;default:1;comment:状态 1=正常 0=禁用" json:"status"`
	DailyQuota int            `gorm:"not null;default:0;comment:每日推送上限，0=使用应用默认值" json:"daily_quota"`
	RegisterIP string         `gorm:"size:45;index;comment:注册来源IP" json:"register_ip"`
	LastUsedAt *time.Time     `json:"last_used_at"`
	LastUsedIP string         `gorm:"size:45" json:"last_used_ip,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

// TenantDevice 设备归属。一台设备同一时间只属于一个租户（device_id 唯一），后绑定的覆盖先绑定的。
type TenantDevice struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	AppID     uint      `gorm:"not null;index;comment:应用ID" json:"app_id"`
	TenantID  uint      `gorm:"not null;index;comment:租户ID" json:"tenant_id"`
	DeviceID  uint      `gorm:"not null;uniqueIndex;comment:设备ID" json:"device_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Tenant) TableName() string { return "tenants" }

func (TenantDevice) TableName() string { return "tenant_devices" }
