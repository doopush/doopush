package models

import (
	"time"

	"gorm.io/gorm"
)

// PushLog 推送日志模型
type PushLog struct {
	ID        uint           `gorm:"primarykey" json:"id" example:"1"`
	AppID     uint           `gorm:"not null;index;comment:应用ID" json:"app_id" binding:"required"`
	DeviceID  uint           `gorm:"not null;index;comment:设备ID" json:"device_id" binding:"required"`
	Title     string         `gorm:"size:200;not null;comment:推送标题" json:"title" example:"新消息" binding:"required"`
	Content   string         `gorm:"type:text;not null;comment:推送内容" json:"content" example:"您有一条新消息" binding:"required"`
	Payload   string         `gorm:"type:json;comment:推送载荷" json:"payload" example:"{\"action\":\"open_page\"}"`
	Channel   string         `gorm:"size:20;not null;comment:推送通道" json:"channel" example:"apns" binding:"required"`
	Status    string         `gorm:"size:20;default:pending;comment:推送状态" json:"status" example:"pending"`
	DedupKey  string         `gorm:"size:64;index;comment:去重键" json:"dedup_key"`
	SendAt    *time.Time     `gorm:"comment:发送时间" json:"send_at"`
	Badge     int            `gorm:"not null;default:1;comment:badge数量" json:"badge"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App        App         `gorm:"foreignKey:AppID" json:"app,omitempty"`
	Device     Device      `gorm:"foreignKey:DeviceID" json:"device,omitempty"`
	PushResult *PushResult `gorm:"foreignKey:PushLogID" json:"result,omitempty"`
}

// PushResult 推送结果模型
type PushResult struct {
	ID           uint           `gorm:"primarykey" json:"id"`
	AppID        uint           `gorm:"not null;index;comment:应用ID" json:"app_id"`
	PushLogID    uint           `gorm:"not null;uniqueIndex;comment:推送日志ID" json:"push_log_id" binding:"required"`
	Success      bool           `gorm:"not null;comment:是否成功" json:"success" example:"true"`
	ErrorCode    string         `gorm:"size:50;comment:错误代码" json:"error_code" example:"InvalidToken"`
	ErrorMessage string         `gorm:"size:500;comment:错误信息" json:"error_message" example:"Invalid device token"`
	ResponseData string         `gorm:"type:json;comment:推送服务响应数据" json:"response_data"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App     App     `gorm:"foreignKey:AppID" json:"app,omitempty"`
	PushLog PushLog `gorm:"foreignKey:PushLogID" json:"push_log,omitempty"`
}

// PushQueue 推送队列模型
type PushQueue struct {
	ID           uint           `gorm:"primarykey" json:"id"`
	AppID        uint           `gorm:"not null;index;comment:应用ID" json:"app_id" binding:"required"`
	Title        string         `gorm:"size:200;not null;comment:推送标题" json:"title" binding:"required"`
	Content      string         `gorm:"type:text;not null;comment:推送内容" json:"content" binding:"required"`
	Payload      string         `gorm:"type:json;comment:推送载荷" json:"payload"`
	Target       string         `gorm:"type:json;not null;comment:推送目标" json:"target" binding:"required"`
	ScheduleTime *time.Time     `gorm:"comment:计划推送时间" json:"schedule_time"`
	Status       string         `gorm:"size:20;default:pending;comment:队列状态" json:"status" example:"pending"`
	Priority     int            `gorm:"default:5;comment:优先级 1-10" json:"priority" example:"5"`
	RetryCount   int            `gorm:"default:0;comment:重试次数" json:"retry_count"`
	MaxRetry     int            `gorm:"default:3;comment:最大重试次数" json:"max_retry"`
	LockedAt     *time.Time     `gorm:"comment:锁定时间" json:"locked_at"`
	LockedBy     string         `gorm:"size:100;comment:锁定者" json:"locked_by"`
	ProcessedAt  *time.Time     `gorm:"comment:处理时间" json:"processed_at"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App App `gorm:"foreignKey:AppID" json:"app,omitempty"`
}

// TableName 设置表名
func (PushLog) TableName() string {
	return "push_logs"
}

// TableName 设置表名
func (PushResult) TableName() string {
	return "push_results"
}

// TableName 设置表名
func (PushQueue) TableName() string {
	return "push_queue"
}
