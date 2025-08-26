package services

import (
	"encoding/json"
	"fmt"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"gorm.io/gorm"
)

// GroupService 设备分组服务
type GroupService struct{}

// NewGroupService 创建分组服务实例
func NewGroupService() *GroupService {
	return &GroupService{}
}

// FilterRuleValue 筛选规则值
type FilterRuleValue struct {
	StringValue  string   `json:"string_value,omitempty" example:"ios"`
	StringValues []string `json:"string_values,omitempty"`
}

// FilterRule 筛选规则
type FilterRule struct {
	Field    string          `json:"field" example:"platform"`  // 筛选字段
	Operator string          `json:"operator" example:"equals"` // 操作符: equals, contains, in, not_in
	Value    FilterRuleValue `json:"value"`                     // 筛选值
}

// CreateGroup 创建设备分组
func (s *GroupService) CreateGroup(appID uint, userID uint, name, description string, filterRules []FilterRule) (*models.DeviceGroup, error) {
	// 检查分组名是否重复
	var existingGroup models.DeviceGroup
	err := database.DB.Where("app_id = ? AND name = ?", appID, name).First(&existingGroup).Error
	if err == nil {
		return nil, fmt.Errorf("分组名称已存在")
	}

	// 序列化筛选规则
	rulesJSON, _ := json.Marshal(filterRules)

	group := &models.DeviceGroup{
		AppID:       appID,
		Name:        name,
		Description: description,
		Conditions:  string(rulesJSON),
		Status:      1, // 1=启用
	}

	if err := database.DB.Create(group).Error; err != nil {
		return nil, fmt.Errorf("创建分组失败: %v", err)
	}

	// 计算分组设备数量 (暂时不存储到模型中，需要时动态计算)
	// count := s.calculateGroupDeviceCount(appID, filterRules)

	return group, nil
}

// GetGroups 获取分组列表
func (s *GroupService) GetGroups(appID uint, page, pageSize int) ([]models.DeviceGroup, int64, error) {
	var total int64
	database.DB.Model(&models.DeviceGroup{}).Where("app_id = ?", appID).Count(&total)

	var groups []models.DeviceGroup
	err := database.DB.Where("app_id = ?", appID).
		Offset((page - 1) * pageSize).Limit(pageSize).
		Order("status DESC, created_at DESC").
		Find(&groups).Error

	return groups, total, err
}

// GetGroup 获取单个分组
func (s *GroupService) GetGroup(appID uint, groupID uint) (*models.DeviceGroup, error) {
	var group models.DeviceGroup
	err := database.DB.Where("app_id = ? AND id = ?", appID, groupID).First(&group).Error
	if err != nil {
		return nil, fmt.Errorf("分组不存在")
	}
	return &group, nil
}

// UpdateGroup 更新分组
func (s *GroupService) UpdateGroup(appID uint, groupID uint, name, description string, filterRules []FilterRule, isActive bool) (*models.DeviceGroup, error) {
	var group models.DeviceGroup
	err := database.DB.Where("app_id = ? AND id = ?", appID, groupID).First(&group).Error
	if err != nil {
		return nil, fmt.Errorf("分组不存在")
	}

	// 检查名称是否与其他分组冲突
	if name != group.Name {
		var existingGroup models.DeviceGroup
		err := database.DB.Where("app_id = ? AND name = ? AND id != ?", appID, name, groupID).First(&existingGroup).Error
		if err == nil {
			return nil, fmt.Errorf("分组名称已存在")
		}
	}

	// 更新分组信息
	group.Name = name
	group.Description = description
	group.Status = 1
	if !isActive {
		group.Status = 0
	}

	if filterRules != nil {
		rulesJSON, _ := json.Marshal(filterRules)
		group.Conditions = string(rulesJSON)
	}

	if err := database.DB.Save(&group).Error; err != nil {
		return nil, fmt.Errorf("更新分组失败: %v", err)
	}

	return &group, nil
}

// DeleteGroup 删除分组
func (s *GroupService) DeleteGroup(appID uint, groupID uint) error {
	result := database.DB.Where("app_id = ? AND id = ?", appID, groupID).Delete(&models.DeviceGroup{})
	if result.Error != nil {
		return fmt.Errorf("删除分组失败: %v", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("分组不存在")
	}
	return nil
}

// GetGroupDevices 获取分组设备列表
func (s *GroupService) GetGroupDevices(appID uint, groupID uint, page, pageSize int) ([]models.Device, int64, error) {
	// 获取分组
	group, err := s.GetGroup(appID, groupID)
	if err != nil {
		return nil, 0, err
	}

	// 解析筛选规则
	var filterRules []FilterRule
	if group.Conditions != "" {
		if err := json.Unmarshal([]byte(group.Conditions), &filterRules); err != nil {
			return nil, 0, fmt.Errorf("解析筛选规则失败: %v", err)
		}
	}

	// 构建查询
	query := database.DB.Where("app_id = ?", appID)
	query = s.applyFilterRules(query, filterRules)

	// 获取总数
	var total int64
	query.Model(&models.Device{}).Count(&total)

	// 获取设备列表
	var devices []models.Device
	err = query.Offset((page - 1) * pageSize).Limit(pageSize).
		Order("last_seen DESC").Find(&devices).Error

	return devices, total, err
}

// calculateGroupDeviceCount 计算分组设备数量
func (s *GroupService) calculateGroupDeviceCount(appID uint, filterRules []FilterRule) int {
	query := database.DB.Model(&models.Device{}).Where("app_id = ?", appID)
	query = s.applyFilterRules(query, filterRules)

	var count int64
	query.Count(&count)
	return int(count)
}

// applyFilterRules 应用筛选规则到查询
func (s *GroupService) applyFilterRules(query *gorm.DB, filterRules []FilterRule) *gorm.DB {
	for _, rule := range filterRules {
		switch rule.Operator {
		case "equals":
			if rule.Value.StringValue != "" {
				query = query.Where(fmt.Sprintf("%s = ?", rule.Field), rule.Value.StringValue)
			}
		case "contains":
			if rule.Value.StringValue != "" {
				query = query.Where(fmt.Sprintf("%s LIKE ?", rule.Field), fmt.Sprintf("%%%s%%", rule.Value.StringValue))
			}
		case "in":
			if len(rule.Value.StringValues) > 0 {
				query = query.Where(fmt.Sprintf("%s IN ?", rule.Field), rule.Value.StringValues)
			}
		case "not_in":
			if len(rule.Value.StringValues) > 0 {
				query = query.Where(fmt.Sprintf("%s NOT IN ?", rule.Field), rule.Value.StringValues)
			}
		case "is_null":
			query = query.Where(fmt.Sprintf("%s IS NULL", rule.Field))
		case "is_not_null":
			query = query.Where(fmt.Sprintf("%s IS NOT NULL", rule.Field))
		}
	}
	return query
}

// RefreshGroupDeviceCount 刷新分组设备数量
func (s *GroupService) RefreshGroupDeviceCount(appID uint, groupID uint) error {
	group, err := s.GetGroup(appID, groupID)
	if err != nil {
		return err
	}

	var filterRules []FilterRule
	if group.Conditions != "" {
		if err := json.Unmarshal([]byte(group.Conditions), &filterRules); err != nil {
			return fmt.Errorf("解析筛选规则失败: %v", err)
		}
	}

	// count := s.calculateGroupDeviceCount(appID, filterRules)
	// 暂时不更新设备数量，因为模型中没有DeviceCount字段

	return database.DB.Save(group).Error
}
