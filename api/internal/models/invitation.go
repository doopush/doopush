package models

import "time"

// AppInvitation 应用成员邀请，同时作为收件箱中的历史记录。
type AppInvitation struct {
	ID                   uint       `gorm:"primarykey" json:"id"`
	AppID                uint       `gorm:"not null;index" json:"app_id"`
	InviterID            uint       `gorm:"not null;index" json:"inviter_id"`
	InviteeID            uint       `gorm:"not null;index" json:"invitee_id"`
	Role                 string     `gorm:"size:20;not null" json:"role"`
	Status               string     `gorm:"size:20;not null;default:pending;index" json:"status"`
	PendingKey           *string    `gorm:"size:64;uniqueIndex" json:"-"`
	AppNameSnapshot      string     `gorm:"size:100;not null" json:"app_name"`
	AppIconSnapshot      string     `gorm:"size:255" json:"app_icon"`
	InviterNameSnapshot  string     `gorm:"size:100;not null" json:"inviter_name"`
	InviteeNameSnapshot  string     `gorm:"size:100;not null" json:"invitee_name"`
	InviteeEmailSnapshot string     `gorm:"size:100;not null" json:"invitee_email"`
	ReadAt               *time.Time `json:"read_at"`
	RespondedAt          *time.Time `json:"responded_at"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

func (AppInvitation) TableName() string {
	return "app_invitations"
}

// AppInviteCandidate 精确邮箱查询的邀请对象。
type AppInviteCandidate struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	State    string `json:"state"`
}
