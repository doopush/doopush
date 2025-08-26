package services

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
)

// AuditService 审计日志服务
type AuditService struct{}

// NewAuditService 创建审计服务实例
func NewAuditService() *AuditService {
	return &AuditService{}
}

// LogAction 记录操作日志
func (s *AuditService) LogAction(userID uint, appID *uint, action, resource, resourceID string, oldData, newData interface{}, ipAddress, userAgent string) error {
	var newDataJSON string

	if newData != nil {
		if data, err := json.Marshal(newData); err == nil {
			newDataJSON = string(data)
		}
	}

	auditLog := &models.AuditLog{
		UserID:    userID,
		Action:    action,
		Resource:  resource,
		Details:   newDataJSON, // 使用Details字段存储操作详情
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}

	// 如果有appID，则设置
	if appID != nil {
		auditLog.AppID = *appID
	}

	if err := database.DB.Create(auditLog).Error; err != nil {
		return fmt.Errorf("记录审计日志失败: %v", err)
	}

	return nil
}

// GetGlobalAuditLogs 获取全局审计日志 (管理员)
func (s *AuditService) GetGlobalAuditLogs(userID uint, action, resource string, startTime, endTime *time.Time, page, pageSize int) ([]models.AuditLog, int64, error) {
	query := database.DB.Model(&models.AuditLog{})

	// 查询条件
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if resource != "" {
		query = query.Where("resource = ?", resource)
	}
	if startTime != nil {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime != nil {
		query = query.Where("created_at <= ?", endTime)
	}

	// 获取总数
	var total int64
	query.Count(&total)

	// 获取日志列表
	var logs []models.AuditLog
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).
		Order("created_at DESC").Find(&logs).Error

	return logs, total, err
}

// GetAppAuditLogs 获取应用审计日志
func (s *AuditService) GetAppAuditLogs(appID uint, userID uint, action, resource string, startTime, endTime *time.Time, page, pageSize int) ([]models.AuditLog, int64, error) {
	query := database.DB.Model(&models.AuditLog{}).Where("app_id = ?", appID)

	// 查询条件
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if resource != "" {
		query = query.Where("resource = ?", resource)
	}
	if startTime != nil {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime != nil {
		query = query.Where("created_at <= ?", endTime)
	}

	// 获取总数
	var total int64
	query.Count(&total)

	// 获取日志列表
	var logs []models.AuditLog
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).
		Order("created_at DESC").Find(&logs).Error

	return logs, total, err
}

// LogUserAction 记录用户操作 (便捷方法)
func (s *AuditService) LogUserAction(userID uint, action, resource, resourceID string, oldData, newData interface{}) error {
	return s.LogAction(userID, nil, action, resource, resourceID, oldData, newData, "", "")
}

// LogAppAction 记录应用操作 (便捷方法)
func (s *AuditService) LogAppAction(userID uint, appID uint, action, resource, resourceID string, oldData, newData interface{}) error {
	return s.LogAction(userID, &appID, action, resource, resourceID, oldData, newData, "", "")
}

// LogActionWithContext 记录带上下文的操作 (从HTTP请求中提取IP和UserAgent)
func (s *AuditService) LogActionWithContext(userID uint, appID *uint, action, resource, resourceID, ipAddress, userAgent string, oldData, newData interface{}) error {
	return s.LogAction(userID, appID, action, resource, resourceID, oldData, newData, ipAddress, userAgent)
}

// GetActionStatistics 获取操作统计
func (s *AuditService) GetActionStatistics(appID *uint, days int) ([]ActionStatistic, error) {
	var stats []ActionStatistic

	query := database.DB.Table("audit_logs").
		Select("action, resource, COUNT(*) as count, DATE(created_at) as date").
		Where("created_at >= ?", utils.TimeNow().AddDate(0, 0, -days))

	if appID != nil {
		query = query.Where("app_id = ?", *appID)
	}

	err := query.Group("action, resource, DATE(created_at)").
		Order("date DESC, count DESC").Scan(&stats).Error

	return stats, err
}

// ActionStatistic 操作统计数据
type ActionStatistic struct {
	Action   string `json:"action" example:"create"`
	Resource string `json:"resource" example:"device"`
	Count    int    `json:"count" example:"25"`
	Date     string `json:"date" example:"2024-01-01"`
}

// CleanupOldLogs 清理旧日志 (保留指定天数)
func (s *AuditService) CleanupOldLogs(days int) error {
	cutoffTime := utils.TimeNow().AddDate(0, 0, -days)

	result := database.DB.Where("created_at < ?", cutoffTime).Delete(&models.AuditLog{})
	if result.Error != nil {
		return fmt.Errorf("清理审计日志失败: %v", result.Error)
	}

	return nil
}
