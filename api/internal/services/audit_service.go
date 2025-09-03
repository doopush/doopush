package services

import (
	"encoding/json"
	"fmt"
	"strconv"
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

	// 获取用户名并设置到冗余字段
	if userName := s.getUserName(userID); userName != "" {
		auditLog.UserName = userName
	}

	if err := database.DB.Create(auditLog).Error; err != nil {
		return fmt.Errorf("记录审计日志失败: %v", err)
	}

	return nil
}

// LogActionWithBeforeAfter 记录操作日志包含变更前后数据
func (s *AuditService) LogActionWithBeforeAfter(userID uint, appID *uint, action, resource, resourceID string, beforeData, afterData interface{}, ipAddress, userAgent string) error {
	var beforeDataJSON, afterDataJSON *string
	var detailsJSON string

	// 序列化变更前数据
	if beforeData != nil {
		if data, err := json.Marshal(beforeData); err == nil {
			dataStr := string(data)
			beforeDataJSON = &dataStr
		}
	}

	// 序列化变更后数据
	if afterData != nil {
		if data, err := json.Marshal(afterData); err == nil {
			dataStr := string(data)
			afterDataJSON = &dataStr
			detailsJSON = dataStr // 保持兼容性，Details字段存储新数据
		}
	}

	auditLog := &models.AuditLog{
		UserID:     userID,
		Action:     action,
		Resource:   resource,
		Details:    detailsJSON,
		BeforeData: beforeDataJSON,
		AfterData:  afterDataJSON,
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
	}

	// 如果有appID，则设置
	if appID != nil {
		auditLog.AppID = *appID
	}

	// 设置ResourceID
	if resourceID != "" {
		if id, err := fmt.Sscanf(resourceID, "%d", &auditLog.ResourceID); err == nil && id == 1 {
			// ResourceID转换成功
		}
	}

	// 获取用户名并设置到冗余字段
	if userName := s.getUserName(userID); userName != "" {
		auditLog.UserName = userName
	}

	if err := database.DB.Create(auditLog).Error; err != nil {
		return fmt.Errorf("记录审计日志失败: %v", err)
	}

	return nil
}

// LogActionWithContext 记录操作日志 (用于中间件)
func (s *AuditService) LogActionWithContext(userID uint, appID *uint, action, resource, resourceID, ipAddress, userAgent string, beforeData, afterData interface{}) error {
	var beforeDataJSON, afterDataJSON *string
	var detailsJSON string

	// 序列化变更前数据
	if beforeData != nil {
		if data, err := json.Marshal(beforeData); err == nil {
			dataStr := string(data)
			beforeDataJSON = &dataStr
		}
	}

	// 序列化变更后数据（用作详情）
	if afterData != nil {
		if data, err := json.Marshal(afterData); err == nil {
			dataStr := string(data)
			afterDataJSON = &dataStr
			detailsJSON = dataStr // 保持兼容性，Details字段存储新数据
		}
	}

	auditLog := &models.AuditLog{
		UserID:     userID,
		Action:     action,
		Resource:   resource,
		Details:    detailsJSON,
		BeforeData: beforeDataJSON,
		AfterData:  afterDataJSON,
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
	}

	// 如果有resourceID，则转换并设置
	if resourceID != "" {
		if id, err := strconv.ParseUint(resourceID, 10, 32); err == nil {
			auditLog.ResourceID = uint(id)
		}
	}

	// 如果有appID，则设置
	if appID != nil {
		auditLog.AppID = *appID
	}

	// 获取用户名并设置到冗余字段
	if userName := s.getUserName(userID); userName != "" {
		auditLog.UserName = userName
	}

	if err := database.DB.Create(auditLog).Error; err != nil {
		return fmt.Errorf("记录审计日志失败: %v", err)
	}

	return nil
}

// getUserName 获取用户名 (辅助方法)
func (s *AuditService) getUserName(userID uint) string {
	var user models.User
	if err := database.DB.Select("username").Where("id = ?", userID).First(&user).Error; err != nil {
		return ""
	}
	return user.Username
}

// 以下为应用级审计日志查询与统计方法
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

// AuditFilters 审计日志筛选条件
type AuditFilters struct {
	UserID    *uint      `json:"user_id,omitempty"`
	Action    string     `json:"action,omitempty"`
	Resource  string     `json:"resource,omitempty"`
	StartTime *time.Time `json:"start_time,omitempty"`
	EndTime   *time.Time `json:"end_time,omitempty"`
	IPAddress string     `json:"ip_address,omitempty"`
	UserName  string     `json:"user_name,omitempty"`
	AppID     *uint      `json:"app_id,omitempty"`
}

// GetAuditLogsWithAdvancedFilters 使用高级筛选条件获取审计日志
func (s *AuditService) GetAuditLogsWithAdvancedFilters(filters AuditFilters, page, pageSize int) ([]models.AuditLog, int64, error) {
	query := database.DB.Model(&models.AuditLog{}).
		Preload("App"). // 预加载应用信息
		Preload("User") // 预加载用户信息

	// 应用筛选条件
	if filters.UserID != nil {
		query = query.Where("user_id = ?", *filters.UserID)
	}
	if filters.Action != "" {
		query = query.Where("action = ?", filters.Action)
	}
	if filters.Resource != "" {
		query = query.Where("resource = ?", filters.Resource)
	}
	if filters.StartTime != nil {
		query = query.Where("created_at >= ?", filters.StartTime)
	}
	if filters.EndTime != nil {
		query = query.Where("created_at <= ?", filters.EndTime)
	}
	if filters.IPAddress != "" {
		query = query.Where("ip_address LIKE ?", "%"+filters.IPAddress+"%")
	}
	if filters.UserName != "" {
		query = query.Where("user_name LIKE ?", "%"+filters.UserName+"%")
	}
	if filters.AppID != nil {
		query = query.Where("app_id = ?", *filters.AppID)
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

// GetOperationStatistics 获取操作统计数据（增强版）
func (s *AuditService) GetOperationStatistics(appID *uint, days int) ([]OperationStat, error) {
	var stats []OperationStat

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

// OperationStat 操作统计数据（增强版）
type OperationStat struct {
	Action   string `json:"action" example:"create"`
	Resource string `json:"resource" example:"device"`
	Count    int    `json:"count" example:"25"`
	Date     string `json:"date" example:"2024-01-01"`
}

// GetUserActivityStats 获取用户活动统计
func (s *AuditService) GetUserActivityStats(appID *uint, days int, limit int) ([]UserActivityStat, error) {
	var stats []UserActivityStat

	query := database.DB.Table("audit_logs").
		Select("user_id, user_name, COUNT(*) as activity_count, MAX(created_at) as last_activity").
		Where("created_at >= ?", utils.TimeNow().AddDate(0, 0, -days))

	if appID != nil {
		query = query.Where("app_id = ?", *appID)
	}

	err := query.Group("user_id, user_name").
		Order("activity_count DESC").
		Limit(limit).Scan(&stats).Error

	return stats, err
}

// UserActivityStat 用户活动统计
type UserActivityStat struct {
	UserID        uint      `json:"user_id"`
	UserName      string    `json:"user_name"`
	ActivityCount int       `json:"activity_count"`
	LastActivity  time.Time `json:"last_activity"`
}

// LogUserAction 记录用户操作 (便捷方法)
func (s *AuditService) LogUserAction(userID uint, action, resource, resourceID string, oldData, newData interface{}) error {
	return s.LogAction(userID, nil, action, resource, resourceID, oldData, newData, "", "")
}

// LogAppAction 记录应用操作 (便捷方法)
func (s *AuditService) LogAppAction(userID uint, appID uint, action, resource, resourceID string, oldData, newData interface{}) error {
	return s.LogAction(userID, &appID, action, resource, resourceID, oldData, newData, "", "")
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
