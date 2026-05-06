package models

import (
	"time"

	"gorm.io/gorm"
)

// BaseCallback 回执基础模型
type BaseCallback struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	AppID       uint           `gorm:"not null;index;comment:应用ID" json:"app_id"`
	DeviceID    uint           `gorm:"index;comment:设备ID" json:"device_id"`
	PushLogID   uint           `gorm:"index;comment:推送日志ID" json:"push_log_id"`
	MessageID   string         `gorm:"size:200;index;comment:消息ID" json:"message_id"`
	DeviceToken string         `gorm:"size:500;comment:设备Token" json:"device_token"`
	EventType   int            `gorm:"comment:事件类型" json:"event_type"`
	Success     bool           `gorm:"comment:是否成功" json:"success"`
	Timestamp   int64          `gorm:"comment:回执时间戳" json:"timestamp"`
	ProcessedAt time.Time      `gorm:"comment:处理时间" json:"processed_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// HuaweiCallback 华为推送回执
type HuaweiCallback struct {
	BaseCallback
	BiTag        string `gorm:"size:200;comment:业务标识" json:"bi_tag"`
	ValidateOnly bool   `gorm:"comment:是否仅验证" json:"validate_only"`
	Title        string `gorm:"size:500;comment:推送标题" json:"title"`
	Body         string `gorm:"type:text;comment:推送内容" json:"body"`
	ClickType    int    `gorm:"comment:点击类型" json:"click_type"`
	RawData      string `gorm:"type:json;comment:原始数据" json:"raw_data"`
}

// HonorCallback 荣耀推送回执
type HonorCallback struct {
	BaseCallback
	BiTag     string `gorm:"size:200;comment:业务标识" json:"bi_tag"`
	Status    int    `gorm:"comment:状态码" json:"status"`
	RequestID string `gorm:"size:200;comment:请求ID" json:"request_id"`
	RawData   string `gorm:"type:json;comment:原始数据" json:"raw_data"`
}

// OppoCallback OPPO推送回执
type OppoCallback struct {
	BaseCallback
	TaskID          string `gorm:"size:200;comment:任务ID" json:"task_id"`
	RegistrationIDs string `gorm:"type:text;comment:注册ID列表" json:"registration_ids"`
	EventTime       string `gorm:"size:50;comment:事件时间" json:"event_time"`
	Param           string `gorm:"size:500;comment:回执参数" json:"param"`
	EventTypeName   string `gorm:"size:50;comment:事件类型名称" json:"event_type_name"`
	RawData         string `gorm:"type:json;comment:原始数据" json:"raw_data"`
}

// VivoCallback VIVO推送回执
type VivoCallback struct {
	BaseCallback
	TaskID  string `gorm:"size:200;comment:任务ID" json:"task_id"`
	Targets string `gorm:"size:500;comment:目标设备" json:"targets"`
	AckTime int64  `gorm:"comment:回执时间" json:"ack_time"`
	Param   string `gorm:"size:500;comment:回执参数" json:"param"`
	AckType string `gorm:"size:20;comment:回执类型" json:"ack_type"`
	RawData string `gorm:"type:json;comment:原始数据" json:"raw_data"`
}

// XiaomiCallback 小米推送回执
type XiaomiCallback struct {
	BaseCallback
	JobKey    string `gorm:"size:200;comment:任务Key" json:"job_key"`
	Targets   string `gorm:"type:text;comment:目标设备列表" json:"targets"`
	Param     string `gorm:"size:500;comment:回执参数" json:"param"`
	Type      int    `gorm:"comment:回执类型" json:"type"`
	BarStatus string `gorm:"size:50;comment:状态栏状态" json:"bar_status"`
	RawData   string `gorm:"type:json;comment:原始数据" json:"raw_data"`
}

// MeizuCallback 魅族推送回执
type MeizuCallback struct {
	BaseCallback
	Param   string `gorm:"size:500;comment:回执参数" json:"param"`
	Type    int    `gorm:"comment:回执类型" json:"type"`
	Targets string `gorm:"type:text;comment:目标设备列表" json:"targets"`
	RawData string `gorm:"type:json;comment:原始数据" json:"raw_data"`
}

// ApnsCallback APNS推送回执
type ApnsCallback struct {
	BaseCallback
	Reason     string `gorm:"size:100;comment:失败原因" json:"reason"`
	StatusCode int    `gorm:"comment:状态码" json:"status_code"`
	ApnsID     string `gorm:"size:100;comment:APNS ID" json:"apns_id"`
	CollapseID string `gorm:"size:100;comment:折叠ID" json:"collapse_id"`
	RawData    string `gorm:"type:json;comment:原始数据" json:"raw_data"`
}

// FcmCallback FCM推送回执
type FcmCallback struct {
	BaseCallback
	MulticastID  int64  `gorm:"comment:多播ID" json:"multicast_id"`
	Success      int    `gorm:"comment:成功数量" json:"success_count"`
	Failure      int    `gorm:"comment:失败数量" json:"failure_count"`
	CanonicalIDs int    `gorm:"comment:规范ID数量" json:"canonical_ids"`
	Results      string `gorm:"type:json;comment:结果详情" json:"results"`
	RawData      string `gorm:"type:json;comment:原始数据" json:"raw_data"`
}

// CallbackStatistics 回执统计
type CallbackStatistics struct {
	ID            uint           `gorm:"primarykey" json:"id"`
	AppID         uint           `gorm:"not null;uniqueIndex:idx_callback_stat_app_vendor_date,priority:1;comment:应用ID" json:"app_id"`
	Vendor        string         `gorm:"size:20;not null;uniqueIndex:idx_callback_stat_app_vendor_date,priority:2;comment:厂商" json:"vendor"`
	Date          time.Time      `gorm:"not null;uniqueIndex:idx_callback_stat_app_vendor_date,priority:3;comment:统计日期" json:"date"`
	TotalCount    int            `gorm:"default:0;comment:总回执数" json:"total_count"`
	SuccessCount  int            `gorm:"default:0;comment:成功数" json:"success_count"`
	FailureCount  int            `gorm:"default:0;comment:失败数" json:"failure_count"`
	DeliveryCount int            `gorm:"default:0;comment:送达数" json:"delivery_count"`
	ClickCount    int            `gorm:"default:0;comment:点击数" json:"click_count"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App App `gorm:"foreignKey:AppID" json:"app,omitempty"`
}

// TableName 设置表名
func (HuaweiCallback) TableName() string {
	return "huawei_callbacks"
}

func (HonorCallback) TableName() string {
	return "honor_callbacks"
}

func (OppoCallback) TableName() string {
	return "oppo_callbacks"
}

func (VivoCallback) TableName() string {
	return "vivo_callbacks"
}

func (XiaomiCallback) TableName() string {
	return "xiaomi_callbacks"
}

func (MeizuCallback) TableName() string {
	return "meizu_callbacks"
}

func (ApnsCallback) TableName() string {
	return "apns_callbacks"
}

func (FcmCallback) TableName() string {
	return "fcm_callbacks"
}

func (CallbackStatistics) TableName() string {
	return "callback_statistics"
}
