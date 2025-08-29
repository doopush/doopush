package models

import (
	"time"

	"gorm.io/gorm"
)

// ScheduledPush 定时推送模型
type ScheduledPush struct {
	ID    uint   `gorm:"primarykey" json:"id" example:"1"`
	AppID uint   `gorm:"not null;index;comment:应用ID" json:"app_id" binding:"required"`
	Name  string `gorm:"size:100;not null;comment:任务名称" json:"name" example:"每日签到提醒" binding:"required"`

	// 推送内容
	Title   string `gorm:"size:200;comment:推送标题" json:"title" example:"签到提醒"`
	Content string `gorm:"type:text;comment:推送内容" json:"content" example:"别忘记每日签到领取奖励"`
	Payload string `gorm:"type:json;comment:推送载荷" json:"payload" example:"{\"action\":\"open_signin\"}"`
	Badge   int    `gorm:"not null;default:1;comment:badge数量" json:"badge" example:"1"`

	TemplateID   *uint          `gorm:"comment:模板ID" json:"template_id"`
	PushType     string         `gorm:"size:20;not null;comment:推送类型" json:"push_type" example:"broadcast"`
	TargetType   string         `gorm:"size:20;not null;comment:目标类型" json:"target_type" example:"all" binding:"required"`
	TargetValue  string         `gorm:"size:200;comment:目标值" json:"target_config" example:"vip_users"`
	ScheduleTime time.Time      `gorm:"not null;comment:调度时间" json:"scheduled_at" binding:"required"`
	Timezone     string         `gorm:"size:50;default:UTC;comment:时区" json:"timezone" example:"Asia/Shanghai"`
	RepeatType   string         `gorm:"size:20;default:once;comment:重复类型" json:"repeat_type" example:"daily"`
	RepeatConfig string         `gorm:"size:200;comment:重复配置" json:"repeat_config" example:"1,3,5"`
	CronExpr     string         `gorm:"size:200;comment:Cron表达式" json:"cron_expr" example:"0 9 * * *"`
	NextRunAt    *time.Time     `gorm:"comment:下次运行时间" json:"next_run_at"`
	LastRunAt    *time.Time     `gorm:"comment:上次运行时间" json:"last_run_at"`
	Status       string         `gorm:"size:20;default:pending;comment:任务状态" json:"status" example:"pending"`
	CreatedBy    uint           `gorm:"not null;comment:创建者ID" json:"created_by"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App App `gorm:"foreignKey:AppID" json:"app,omitempty"`
}

// PushStatistics 推送统计模型
type PushStatistics struct {
	ID            uint           `gorm:"primarykey" json:"id"`
	AppID         uint           `gorm:"not null;index;comment:应用ID" json:"app_id" binding:"required"`
	Date          time.Time      `gorm:"not null;index;comment:统计日期" json:"date" binding:"required"`
	TotalPushes   int            `gorm:"default:0;comment:总推送数" json:"total_pushes" example:"1000"`
	SuccessPushes int            `gorm:"default:0;comment:成功推送数" json:"success_pushes" example:"980"`
	FailedPushes  int            `gorm:"default:0;comment:失败推送数" json:"failed_pushes" example:"20"`
	ClickCount    int            `gorm:"default:0;comment:点击数" json:"click_count" example:"150"`
	OpenCount     int            `gorm:"default:0;comment:打开数" json:"open_count" example:"800"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App App `gorm:"foreignKey:AppID" json:"app,omitempty"`
}

// AuditLog 审计日志模型
type AuditLog struct {
	ID         uint           `gorm:"primarykey" json:"id"`
	AppID      uint           `gorm:"not null;index;comment:应用ID" json:"app_id"`
	UserID     uint           `gorm:"not null;index;comment:用户ID" json:"user_id"`
	Action     string         `gorm:"size:50;not null;comment:操作类型" json:"action" example:"create_push"`
	Resource   string         `gorm:"size:100;not null;comment:操作资源" json:"resource" example:"push"`
	ResourceID uint           `gorm:"comment:资源ID" json:"resource_id" example:"123"`
	Details    string         `gorm:"type:json;comment:操作详情" json:"details" example:"{\"title\":\"新消息\"}"`
	IPAddress  string         `gorm:"size:45;comment:IP地址" json:"ip_address" example:"192.168.1.1"`
	UserAgent  string         `gorm:"size:500;comment:用户代理" json:"user_agent"`
	CreatedAt  time.Time      `json:"created_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	App  App  `gorm:"foreignKey:AppID" json:"app,omitempty"`
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// SystemConfig 系统配置模型
type SystemConfig struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	Key         string         `gorm:"size:100;uniqueIndex;not null;comment:配置键" json:"key" example:"max_push_per_day" binding:"required"`
	Value       string         `gorm:"type:text;not null;comment:配置值" json:"value" example:"10000" binding:"required"`
	Type        string         `gorm:"size:20;default:string;comment:值类型" json:"type" example:"integer"`
	Description string         `gorm:"size:500;comment:配置描述" json:"description" example:"每日最大推送数量限制"`
	Category    string         `gorm:"size:50;default:general;comment:配置分类" json:"category" example:"push_limits"`
	IsPublic    bool           `gorm:"default:false;comment:是否公开" json:"is_public" example:"false"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 设置表名
func (ScheduledPush) TableName() string {
	return "scheduled_pushes"
}

// TableName 设置表名
func (PushStatistics) TableName() string {
	return "push_statistics"
}

// TableName 设置表名
func (AuditLog) TableName() string {
	return "audit_logs"
}

// TableName 设置表名
func (SystemConfig) TableName() string {
	return "system_configs"
}
