package services

import (
	"fmt"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
)

// SchedulerService 定时推送服务
type SchedulerService struct{}

// NewSchedulerService 创建定时推送服务实例
func NewSchedulerService() *SchedulerService {
	return &SchedulerService{}
}

// CreateScheduledPush 创建定时推送
func (s *SchedulerService) CreateScheduledPush(appID uint, userID uint, name string, templateID *uint, targetType, targetValue string, scheduleTime time.Time, timezone, repeatType, cronExpr string) (*models.ScheduledPush, error) {
	return s.CreateScheduledPushWithContent(appID, userID, name, "", "", "", targetType, targetValue, scheduleTime, timezone, repeatType, cronExpr)
}

// CreateScheduledPushWithContent 创建包含推送内容的定时推送
func (s *SchedulerService) CreateScheduledPushWithContent(appID uint, userID uint, name, title, content, payload, targetType, targetValue string, scheduleTime time.Time, timezone, repeatType, cronExpr string) (*models.ScheduledPush, error) {
	// 检查任务名是否重复
	var existingPush models.ScheduledPush
	err := database.DB.Where("app_id = ? AND name = ?", appID, name).First(&existingPush).Error
	if err == nil {
		return nil, fmt.Errorf("任务名称已存在")
	}

	// 计算下次执行时间
	nextRunAt := s.calculateNextRunTime(scheduleTime, repeatType, cronExpr)

	scheduledPush := &models.ScheduledPush{
		AppID:        appID,
		Name:         name,
		Title:        title,   // 推送标题
		Content:      content, // 推送内容
		Payload:      payload, // 推送载荷
		TargetType:   targetType,
		TargetValue:  targetValue,
		ScheduleTime: scheduleTime,
		Timezone:     timezone,
		RepeatType:   repeatType,
		CronExpr:     cronExpr,
		NextRunAt:    &nextRunAt,
		Status:       "pending",
		CreatedBy:    userID,
	}

	if err := database.DB.Create(scheduledPush).Error; err != nil {
		return nil, fmt.Errorf("创建定时推送失败: %v", err)
	}

	return scheduledPush, nil
}

// GetScheduledPushes 获取定时推送列表
func (s *SchedulerService) GetScheduledPushes(appID uint, status string, page, pageSize int) ([]models.ScheduledPush, int64, error) {
	query := database.DB.Where("app_id = ?", appID)

	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Model(&models.ScheduledPush{}).Count(&total)

	var pushes []models.ScheduledPush
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).
		Order("created_at DESC").Find(&pushes).Error

	return pushes, total, err
}

// GetScheduledPush 获取单个定时推送
func (s *SchedulerService) GetScheduledPush(appID uint, pushID uint) (*models.ScheduledPush, error) {
	var push models.ScheduledPush
	err := database.DB.Where("app_id = ? AND id = ?", appID, pushID).First(&push).Error
	if err != nil {
		return nil, fmt.Errorf("定时推送不存在")
	}
	return &push, nil
}

// UpdateScheduledPush 更新定时推送
func (s *SchedulerService) UpdateScheduledPush(appID uint, pushID uint, name string, templateID *uint, targetType, targetValue string, scheduleTime time.Time, timezone, repeatType, cronExpr string) (*models.ScheduledPush, error) {
	var push models.ScheduledPush
	err := database.DB.Where("app_id = ? AND id = ?", appID, pushID).First(&push).Error
	if err != nil {
		return nil, fmt.Errorf("定时推送不存在")
	}

	// 检查名称是否与其他任务冲突
	if name != push.Name {
		var existingPush models.ScheduledPush
		err := database.DB.Where("app_id = ? AND name = ? AND id != ?", appID, name, pushID).First(&existingPush).Error
		if err == nil {
			return nil, fmt.Errorf("任务名称已存在")
		}
	}

	// 更新任务信息
	push.Name = name
	push.TemplateID = templateID
	push.TargetType = targetType
	push.TargetValue = targetValue
	push.ScheduleTime = scheduleTime
	push.Timezone = timezone
	push.RepeatType = repeatType
	push.CronExpr = cronExpr

	// 重新计算下次执行时间
	nextRunAt := s.calculateNextRunTime(scheduleTime, repeatType, cronExpr)
	push.NextRunAt = &nextRunAt

	if err := database.DB.Save(&push).Error; err != nil {
		return nil, fmt.Errorf("更新定时推送失败: %v", err)
	}

	return &push, nil
}

// DeleteScheduledPush 删除定时推送
func (s *SchedulerService) DeleteScheduledPush(appID uint, pushID uint) error {
	result := database.DB.Where("app_id = ? AND id = ?", appID, pushID).Delete(&models.ScheduledPush{})
	if result.Error != nil {
		return fmt.Errorf("删除定时推送失败: %v", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("定时推送不存在")
	}
	return nil
}

// PauseScheduledPush 暂停定时推送
func (s *SchedulerService) PauseScheduledPush(appID uint, pushID uint) error {
	result := database.DB.Model(&models.ScheduledPush{}).
		Where("app_id = ? AND id = ? AND status IN ?", appID, pushID, []string{"pending", "active"}).
		Update("status", "paused")

	if result.Error != nil {
		return fmt.Errorf("暂停定时推送失败: %v", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("定时推送不存在或状态不允许暂停")
	}
	return nil
}

// ResumeScheduledPush 恢复定时推送
func (s *SchedulerService) ResumeScheduledPush(appID uint, pushID uint) error {
	var push models.ScheduledPush
	err := database.DB.Where("app_id = ? AND id = ? AND status = ?", appID, pushID, "paused").First(&push).Error
	if err != nil {
		return fmt.Errorf("定时推送不存在或状态不允许恢复")
	}

	// 重新计算下次执行时间
	nextRunAt := s.calculateNextRunTime(push.ScheduleTime, push.RepeatType, push.CronExpr)
	push.NextRunAt = &nextRunAt
	push.Status = "active"

	if err := database.DB.Save(&push).Error; err != nil {
		return fmt.Errorf("恢复定时推送失败: %v", err)
	}

	return nil
}

// ExecuteScheduledPush 执行定时推送
func (s *SchedulerService) ExecuteScheduledPush(pushID uint) error {
	var push models.ScheduledPush
	err := database.DB.Where("id = ? AND status = ?", pushID, "active").First(&push).Error
	if err != nil {
		return fmt.Errorf("定时推送不存在或状态错误")
	}

	// 更新执行时间
	now := utils.TimeNow()
	push.LastRunAt = &now

	// 计算下次执行时间
	if push.RepeatType != "once" {
		nextRunAt := s.calculateNextRunTime(push.ScheduleTime, push.RepeatType, push.CronExpr)
		push.NextRunAt = &nextRunAt
	} else {
		push.Status = "completed"
		push.NextRunAt = nil
	}

	// 保存更新
	if err := database.DB.Save(&push).Error; err != nil {
		return fmt.Errorf("更新定时推送状态失败: %v", err)
	}

	// TODO: 实际执行推送逻辑
	// 这里应该调用推送服务发送消息，基于 targetType 和 targetValue

	return nil
}

// GetPendingSchedules 获取待执行的定时任务
func (s *SchedulerService) GetPendingSchedules() ([]models.ScheduledPush, error) {
	now := utils.TimeNow()

	var pushes []models.ScheduledPush
	err := database.DB.Where("status = ? AND next_run_at <= ?", "active", now).
		Order("next_run_at ASC").Find(&pushes).Error

	return pushes, err
}

// calculateNextRunTime 计算下次执行时间
func (s *SchedulerService) calculateNextRunTime(scheduleTime time.Time, repeatType, cronExpr string) time.Time {
	now := utils.TimeNow()

	switch repeatType {
	case "once":
		return scheduleTime
	case "daily":
		nextTime := scheduleTime
		for nextTime.Before(now) {
			nextTime = nextTime.AddDate(0, 0, 1)
		}
		return nextTime
	case "weekly":
		nextTime := scheduleTime
		for nextTime.Before(now) {
			nextTime = nextTime.AddDate(0, 0, 7)
		}
		return nextTime
	case "monthly":
		nextTime := scheduleTime
		for nextTime.Before(now) {
			nextTime = nextTime.AddDate(0, 1, 0)
		}
		return nextTime
	default:
		// TODO: 支持 cron 表达式解析
		// 目前返回原始时间
		return scheduleTime
	}
}
