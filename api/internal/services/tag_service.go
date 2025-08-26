package services

import (
	"fmt"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
)

// TagService 用户标签服务
type TagService struct{}

// NewTagService 创建标签服务实例
func NewTagService() *TagService {
	return &TagService{}
}

// AddUserTag 添加用户标签
func (s *TagService) AddUserTag(appID uint, userID, tagName, tagValue string) (*models.UserTag, error) {
	// 检查标签是否已存在
	var existingTag models.UserTag
	err := database.DB.Where("app_id = ? AND user_id = ? AND tag_name = ? AND tag_value = ?",
		appID, userID, tagName, tagValue).First(&existingTag).Error
	if err == nil {
		return &existingTag, nil // 标签已存在，直接返回
	}

	tag := &models.UserTag{
		AppID:    appID,
		UserID:   userID,
		TagName:  tagName,
		TagValue: tagValue,
	}

	if err := database.DB.Create(tag).Error; err != nil {
		return nil, fmt.Errorf("添加标签失败: %v", err)
	}

	return tag, nil
}

// GetUserTags 获取用户标签列表
func (s *TagService) GetUserTags(appID uint, userID string) ([]models.UserTag, error) {
	var tags []models.UserTag
	err := database.DB.Where("app_id = ? AND user_id = ?", appID, userID).
		Order("tag_name, tag_value").Find(&tags).Error
	return tags, err
}

// DeleteUserTag 删除用户标签
func (s *TagService) DeleteUserTag(appID uint, userID, tagName string) error {
	result := database.DB.Where("app_id = ? AND user_id = ? AND tag_name = ?",
		appID, userID, tagName).Delete(&models.UserTag{})

	if result.Error != nil {
		return fmt.Errorf("删除标签失败: %v", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("标签不存在")
	}

	return nil
}

// GetAppTagStatistics 获取应用标签统计
func (s *TagService) GetAppTagStatistics(appID uint) ([]TagStatistic, error) {
	var stats []TagStatistic

	// 查询每个标签的用户数量统计
	err := database.DB.Table("user_tags").
		Select("tag_name, tag_value, COUNT(DISTINCT user_id) as user_count").
		Where("app_id = ?", appID).
		Group("tag_name, tag_value").
		Order("tag_name, user_count DESC").
		Scan(&stats).Error

	return stats, err
}

// TagStatistic 标签统计数据
type TagStatistic struct {
	TagName   string `json:"tag_name" example:"vip_level"`
	TagValue  string `json:"tag_value" example:"gold"`
	UserCount int    `json:"user_count" example:"156"`
}

// GetUsersByTag 根据标签获取用户ID列表
func (s *TagService) GetUsersByTag(appID uint, tagName, tagValue string) ([]string, error) {
	var userIDs []string

	query := database.DB.Model(&models.UserTag{}).
		Select("DISTINCT user_id").
		Where("app_id = ? AND tag_name = ?", appID, tagName)

	if tagValue != "" {
		query = query.Where("tag_value = ?", tagValue)
	}

	err := query.Pluck("user_id", &userIDs).Error
	return userIDs, err
}

// BatchAddUserTags 批量添加用户标签
func (s *TagService) BatchAddUserTags(appID uint, userTags []models.UserTag) error {
	// 使用批量插入，忽略重复项
	return database.DB.Create(&userTags).Error
}

// DeleteAllUserTags 删除用户的所有标签
func (s *TagService) DeleteAllUserTags(appID uint, userID string) error {
	return database.DB.Where("app_id = ? AND user_id = ?", appID, userID).
		Delete(&models.UserTag{}).Error
}
