package services

import (
	"fmt"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
)

// TagService 设备标签服务
type TagService struct{}

// NewTagService 创建标签服务实例
func NewTagService() *TagService {
	return &TagService{}
}

// AddDeviceTag 添加设备标签
func (s *TagService) AddDeviceTag(appID uint, deviceToken, tagName, tagValue string) (*models.DeviceTag, error) {
	// 检查标签是否已存在
	var existingTag models.DeviceTag
	err := database.DB.Where("app_id = ? AND device_token = ? AND tag_name = ? AND tag_value = ?",
		appID, deviceToken, tagName, tagValue).First(&existingTag).Error
	if err == nil {
		return &existingTag, nil // 标签已存在，直接返回
	}

	tag := &models.DeviceTag{
		AppID:       appID,
		DeviceToken: deviceToken,
		TagName:     tagName,
		TagValue:    tagValue,
	}

	if err := database.DB.Create(tag).Error; err != nil {
		return nil, fmt.Errorf("添加标签失败: %v", err)
	}

	return tag, nil
}

// GetDeviceTags 获取设备标签列表
func (s *TagService) GetDeviceTags(appID uint, deviceToken string) ([]models.DeviceTag, error) {
	var tags []models.DeviceTag
	err := database.DB.Where("app_id = ? AND device_token = ?", appID, deviceToken).
		Order("tag_name, tag_value").Find(&tags).Error
	return tags, err
}

// DeleteDeviceTag 删除设备标签
func (s *TagService) DeleteDeviceTag(appID uint, deviceToken, tagName string) error {
	result := database.DB.Where("app_id = ? AND device_token = ? AND tag_name = ?",
		appID, deviceToken, tagName).Delete(&models.DeviceTag{})

	if result.Error != nil {
		return fmt.Errorf("删除标签失败: %v", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("标签不存在")
	}

	return nil
}

// GetAppTagStatistics 获取应用标签统计
func (s *TagService) GetAppTagStatistics(appID uint, page, limit int, search string) (*TagStatisticsResponse, error) {
	var stats []TagStatistic
	var total int64

	// 基础查询
	query := database.DB.Table("device_tags").Where("app_id = ?", appID)

	// 添加搜索条件
	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("tag_name LIKE ? OR tag_value LIKE ?", searchPattern, searchPattern)
	}

	// 获取总数
	countQuery := query.Select("DISTINCT tag_name, tag_value")
	err := database.DB.Table("(?) as sub", countQuery).Count(&total).Error
	if err != nil {
		return nil, err
	}

	// 获取分页数据
	offset := (page - 1) * limit
	err = query.
		Select("tag_name, tag_value, COUNT(DISTINCT device_token) as device_count").
		Group("tag_name, tag_value").
		Order("tag_name, device_count DESC").
		Limit(limit).
		Offset(offset).
		Scan(&stats).Error

	if err != nil {
		return nil, err
	}

	// 计算分页信息
	totalPages := (int(total) + limit - 1) / limit
	hasNext := page < totalPages
	hasPrev := page > 1

	return &TagStatisticsResponse{
		Data: stats,
		Pagination: PaginationInfo{
			Page:       page,
			Limit:      limit,
			Total:      int(total),
			TotalPages: totalPages,
			HasNext:    hasNext,
			HasPrev:    hasPrev,
		},
	}, nil
}

// TagStatistic 标签统计数据
type TagStatistic struct {
	TagName     string `json:"tag_name" example:"vip_level"`
	TagValue    string `json:"tag_value" example:"gold"`
	DeviceCount int    `json:"device_count" example:"156"`
}

// TagStatisticsResponse 标签统计响应
type TagStatisticsResponse struct {
	Data       []TagStatistic `json:"data"`
	Pagination PaginationInfo `json:"pagination"`
}

// PaginationInfo 分页信息
type PaginationInfo struct {
	Page       int  `json:"page" example:"1"`
	Limit      int  `json:"limit" example:"20"`
	Total      int  `json:"total" example:"156"`
	TotalPages int  `json:"total_pages" example:"8"`
	HasNext    bool `json:"has_next" example:"true"`
	HasPrev    bool `json:"has_prev" example:"false"`
}

// GetDevicesByTag 根据标签获取设备Token列表
func (s *TagService) GetDevicesByTag(appID uint, tagName, tagValue string) ([]string, error) {
	var deviceTokens []string

	query := database.DB.Model(&models.DeviceTag{}).
		Select("DISTINCT device_token").
		Where("app_id = ? AND tag_name = ?", appID, tagName)

	if tagValue != "" {
		query = query.Where("tag_value = ?", tagValue)
	}

	err := query.Pluck("device_token", &deviceTokens).Error
	return deviceTokens, err
}

// BatchAddDeviceTags 批量添加设备标签
func (s *TagService) BatchAddDeviceTags(appID uint, deviceTags []models.DeviceTag) error {
	// 使用批量插入，忽略重复项
	return database.DB.Create(&deviceTags).Error
}

// DeleteAllDeviceTags 删除设备的所有标签
func (s *TagService) DeleteAllDeviceTags(appID uint, deviceToken string) error {
	return database.DB.Where("app_id = ? AND device_token = ?", appID, deviceToken).
		Delete(&models.DeviceTag{}).Error
}

// ListDeviceTags 分页获取设备标签（支持过滤）
func (s *TagService) ListDeviceTags(appID uint, page, pageSize int, deviceToken, tagName, tagValue, search string) ([]models.DeviceTag, int64, error) {
	var tags []models.DeviceTag
	var total int64

	query := database.DB.Model(&models.DeviceTag{}).Where("app_id = ?", appID)

	if deviceToken != "" {
		query = query.Where("device_token = ?", deviceToken)
	}
	if tagName != "" {
		query = query.Where("tag_name = ?", tagName)
	}
	if tagValue != "" {
		query = query.Where("tag_value = ?", tagValue)
	}
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("device_token LIKE ? OR tag_name LIKE ? OR tag_value LIKE ?", like, like, like)
	}

	// 统计总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&tags).Error; err != nil {
		return nil, 0, err
	}

	return tags, total, nil
}
