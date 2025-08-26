package models

import (
	"time"

	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	ID        uint           `gorm:"primarykey" json:"id" example:"1"`
	Username  string         `gorm:"uniqueIndex;size:50;not null" json:"username" example:"admin" binding:"required"`
	Email     string         `gorm:"uniqueIndex;size:100;not null" json:"email" example:"admin@example.com" binding:"required,email"`
	Password  string         `gorm:"size:255;not null" json:"-" binding:"required,min=6"`
	Nickname  string         `gorm:"size:50" json:"nickname" example:"管理员"`
	Avatar    string         `gorm:"size:500" json:"avatar" example:"https://example.com/avatar.jpg"`
	Status    int            `gorm:"default:1;comment:用户状态 1=正常 0=禁用" json:"status" example:"1"`
	LastLogin *time.Time     `gorm:"comment:最后登录时间" json:"last_login"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	AppPermissions []UserAppPermission `gorm:"foreignKey:UserID" json:"app_permissions,omitempty"`
}

// UserAppPermission 用户应用权限模型
type UserAppPermission struct {
	ID     uint   `gorm:"primarykey" json:"id"`
	UserID uint   `gorm:"not null;comment:用户ID" json:"user_id" binding:"required"`
	AppID  uint   `gorm:"not null;comment:应用ID" json:"app_id" binding:"required"`
	Role   string `gorm:"size:20;not null;default:viewer;comment:权限角色" json:"role" example:"viewer" binding:"required,oneof=owner developer viewer"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
	App  App  `gorm:"foreignKey:AppID" json:"app,omitempty"`
}

// TableName 设置表名
func (User) TableName() string {
	return "users"
}

// TableName 设置表名
func (UserAppPermission) TableName() string {
	return "user_app_permissions"
}
