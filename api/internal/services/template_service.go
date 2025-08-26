package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
)

// TemplateService 消息模板服务
type TemplateService struct{}

// TemplateVariable 模板变量定义
type TemplateVariable struct {
	Type        string `json:"type" example:"string"`          // 变量类型
	Description string `json:"description" example:"用户名"`      // 变量描述
	Default     string `json:"default,omitempty" example:"用户"` // 默认值
}

// convertVariablesToInterface 将强类型变量转换为 interface{} 类型，用于向后兼容
func convertVariablesToInterface(variables map[string]TemplateVariable) map[string]interface{} {
	result := make(map[string]interface{})
	for key, variable := range variables {
		result[key] = map[string]interface{}{
			"type":        variable.Type,
			"description": variable.Description,
			"default":     variable.Default,
		}
	}
	return result
}

// NewTemplateService 创建模板服务实例
func NewTemplateService() *TemplateService {
	return &TemplateService{}
}

// CreateTemplate 创建消息模板
func (s *TemplateService) CreateTemplate(appID uint, userID uint, name, title, content, platform, locale string, variables map[string]TemplateVariable) (*models.MessageTemplate, error) {
	// 检查模板名是否重复
	var existingTemplate models.MessageTemplate
	err := database.DB.Where("app_id = ? AND name = ? AND locale = ?", appID, name, locale).First(&existingTemplate).Error
	if err == nil {
		return nil, fmt.Errorf("模板名称已存在")
	}

	// 序列化变量定义
	variablesInterface := convertVariablesToInterface(variables)
	variablesJSON, _ := json.Marshal(variablesInterface)

	template := &models.MessageTemplate{
		AppID:     appID,
		Name:      name,
		Title:     title,
		Content:   content,
		Variables: string(variablesJSON),
		Platform:  platform,
		Locale:    locale,
		Version:   1,
		IsActive:  true,
		CreatedBy: userID,
	}

	if err := database.DB.Create(template).Error; err != nil {
		return nil, fmt.Errorf("创建模板失败: %v", err)
	}

	return template, nil
}

// GetTemplates 获取模板列表
func (s *TemplateService) GetTemplates(appID uint, platform, locale string, page, pageSize int) ([]models.MessageTemplate, int64, error) {
	query := database.DB.Where("app_id = ?", appID)

	if platform != "" && platform != "all" {
		query = query.Where("platform = ? OR platform = ?", platform, "all")
	}
	if locale != "" {
		query = query.Where("locale = ?", locale)
	}

	var total int64
	query.Model(&models.MessageTemplate{}).Count(&total)

	var templates []models.MessageTemplate
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).
		Order("is_active DESC, created_at DESC").
		Find(&templates).Error

	return templates, total, err
}

// GetTemplate 获取单个模板
func (s *TemplateService) GetTemplate(appID uint, templateID uint) (*models.MessageTemplate, error) {
	var template models.MessageTemplate
	err := database.DB.Where("app_id = ? AND id = ?", appID, templateID).First(&template).Error
	if err != nil {
		return nil, fmt.Errorf("模板不存在")
	}
	return &template, nil
}

// UpdateTemplate 更新模板
func (s *TemplateService) UpdateTemplate(appID uint, templateID uint, name, title, content, platform, locale string, variables map[string]TemplateVariable, isActive bool) (*models.MessageTemplate, error) {
	var template models.MessageTemplate
	err := database.DB.Where("app_id = ? AND id = ?", appID, templateID).First(&template).Error
	if err != nil {
		return nil, fmt.Errorf("模板不存在")
	}

	// 检查名称是否与其他模板冲突
	if name != template.Name {
		var existingTemplate models.MessageTemplate
		err := database.DB.Where("app_id = ? AND name = ? AND locale = ? AND id != ?", appID, name, locale, templateID).First(&existingTemplate).Error
		if err == nil {
			return nil, fmt.Errorf("模板名称已存在")
		}
	}

	// 更新版本号
	template.Version++
	template.Name = name
	template.Title = title
	template.Content = content
	template.Platform = platform
	template.Locale = locale
	template.IsActive = isActive

	if variables != nil {
		variablesInterface := convertVariablesToInterface(variables)
		variablesJSON, _ := json.Marshal(variablesInterface)
		template.Variables = string(variablesJSON)
	}

	if err := database.DB.Save(&template).Error; err != nil {
		return nil, fmt.Errorf("更新模板失败: %v", err)
	}

	return &template, nil
}

// DeleteTemplate 删除模板
func (s *TemplateService) DeleteTemplate(appID uint, templateID uint) error {
	result := database.DB.Where("app_id = ? AND id = ?", appID, templateID).Delete(&models.MessageTemplate{})
	if result.Error != nil {
		return fmt.Errorf("删除模板失败: %v", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("模板不存在")
	}
	return nil
}

// RenderTemplate 渲染模板 (变量替换)
func (s *TemplateService) RenderTemplate(template *models.MessageTemplate, data map[string]string) (string, string, error) {
	title := template.Title
	content := template.Content

	// 简单的变量替换: {{variable_name}}
	for key, value := range data {
		placeholder := fmt.Sprintf("{{%s}}", key)
		title = strings.ReplaceAll(title, placeholder, value)
		content = strings.ReplaceAll(content, placeholder, value)
	}

	// 检查是否还有未替换的变量
	re := regexp.MustCompile(`\{\{[^}]+\}\}`)
	unresolvedVars := re.FindAllString(content, -1)
	if len(unresolvedVars) > 0 {
		return "", "", fmt.Errorf("模板中存在未解析的变量: %v", unresolvedVars)
	}

	return title, content, nil
}

// GetTemplateVariables 获取模板变量定义
func (s *TemplateService) GetTemplateVariables(template *models.MessageTemplate) (map[string]interface{}, error) {
	if template.Variables == "" {
		return make(map[string]interface{}), nil
	}

	var variables map[string]interface{}
	if err := json.Unmarshal([]byte(template.Variables), &variables); err != nil {
		return nil, fmt.Errorf("解析模板变量失败: %v", err)
	}

	return variables, nil
}
