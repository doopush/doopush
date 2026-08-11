package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
)

const (
	AppKeyPrefix    = "dp_ak_"
	AppSecretPrefix = "dp_as_"

	ScopePushSend      = "push:send"
	ScopePushBroadcast = "push:broadcast"
	ScopePushSchedule  = "push:schedule"
)

var ValidAppSecretScopes = []string{
	ScopePushSend,
	ScopePushBroadcast,
	ScopePushSchedule,
}

type StringList []string

func (s StringList) Value() (driver.Value, error) {
	return json.Marshal(s)
}

func (s *StringList) Scan(value interface{}) error {
	if value == nil {
		*s = StringList{}
		return nil
	}
	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return errors.New("unsupported StringList value")
	}
	return json.Unmarshal(data, s)
}

func (s StringList) Contains(scope string) bool {
	for _, item := range s {
		if item == scope {
			return true
		}
	}
	return false
}

// AppSecret 是客户服务端使用的可撤销、可限定权限的机密凭证。
type AppSecret struct {
	ID         uint           `gorm:"primarykey" json:"id"`
	AppID      uint           `gorm:"not null;index" json:"app_id"`
	Name       string         `gorm:"size:100;not null" json:"name"`
	SecretHash string         `gorm:"size:64;uniqueIndex;not null" json:"-"`
	Prefix     string         `gorm:"size:32;not null" json:"prefix"`
	Suffix     string         `gorm:"size:8;not null" json:"suffix"`
	Scopes     StringList     `gorm:"type:json;not null" json:"scopes"`
	Status     int            `gorm:"not null;default:1" json:"status"`
	ExpiresAt  *time.Time     `json:"expires_at"`
	RevokedAt  *time.Time     `json:"revoked_at"`
	LastUsedAt *time.Time     `json:"last_used_at"`
	LastUsedIP string         `gorm:"size:45" json:"last_used_ip,omitempty"`
	CreatedBy  uint           `gorm:"not null" json:"created_by"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AppSecret) TableName() string { return "app_secrets" }
