package models

import (
	"time"

	"gorm.io/gorm"
)

// ExportToken 导出令牌模型
type ExportToken struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	Token       string         `gorm:"size:64;uniqueIndex;not null;comment:下载令牌" json:"token"`
	AppID       uint           `gorm:"not null;index;comment:应用ID" json:"app_id"`
	UserID      uint           `gorm:"not null;index;comment:用户ID" json:"user_id"`
	FilePath    string         `gorm:"size:500;not null;comment:文件路径" json:"file_path"`
	Filename    string         `gorm:"size:255;not null;comment:文件名" json:"filename"`
	ContentType string         `gorm:"size:100;not null;comment:内容类型" json:"content_type"`
	ExpiresAt   time.Time      `gorm:"not null;index;comment:过期时间" json:"expires_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App  App  `gorm:"foreignKey:AppID" json:"app,omitempty"`
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TableName 设置表名
func (ExportToken) TableName() string {
	return "export_tokens"
}

// IsExpired 检查令牌是否过期
func (e *ExportToken) IsExpired() bool {
	return time.Now().After(e.ExpiresAt)
}