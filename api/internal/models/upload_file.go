package models

import (
	"time"

	"gorm.io/gorm"
)

// UploadFile 上传文件记录模型
type UploadFile struct {
	ID               uint           `gorm:"primarykey" json:"id" example:"1"`
	UserID           uint           `gorm:"not null;comment:上传用户ID" json:"user_id" example:"1" binding:"required"`
	OriginalFilename string         `gorm:"size:255;not null;comment:原始文件名" json:"original_filename" example:"my_app_icon.png"`
	Filename         string         `gorm:"size:255;not null;comment:存储文件名" json:"filename" example:"app_icon_1234567890.png"`
	FilePath         string         `gorm:"size:500;not null;comment:文件存储路径" json:"file_path" example:"uploads/icons/app_icon_1234567890.png"`
	FileURL          string         `gorm:"size:500;not null;comment:文件访问URL" json:"file_url" example:"/uploads/icons/app_icon_1234567890.png"`
	FileSize         int64          `gorm:"not null;comment:文件大小(字节)" json:"file_size" example:"123456"`
	MimeType         string         `gorm:"size:100;not null;comment:MIME类型" json:"mime_type" example:"image/png"`
	UploadType       string         `gorm:"size:50;not null;comment:上传类型" json:"upload_type" example:"app_icon"`
	Status           int            `gorm:"default:1;comment:文件状态 1=正常 0=已删除" json:"status" example:"1"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TableName 设置表名
func (UploadFile) TableName() string {
	return "upload_files"
}
