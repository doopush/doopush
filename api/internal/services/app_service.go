package services

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
)

// AppService 应用服务
type AppService struct{}

// NewAppService 创建应用服务
func NewAppService() *AppService {
	return &AppService{}
}

// CreateApp 创建应用
func (s *AppService) CreateApp(userID uint, name, packageName, description, platform, appIcon string) (*models.App, error) {
	// 检查包名是否已存在
	var existingApp models.App
	if err := database.DB.Where("package_name = ?", packageName).First(&existingApp).Error; err == nil {
		return nil, errors.New("包名已存在")
	}

	// 创建应用
	app := &models.App{
		Name:        name,
		PackageName: packageName,
		Description: description,
		Platform:    platform,
		AppIcon:     appIcon,
		Status:      1,
	}

	// 开启事务
	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 创建应用
	if err := tx.Create(app).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("应用创建失败")
	}

	// 给创建者分配owner权限
	permission := &models.UserAppPermission{
		UserID: userID,
		AppID:  app.ID,
		Role:   "owner",
	}
	if err := tx.Create(permission).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("权限分配失败")
	}

	// 生成默认API密钥
	keyBody := utils.GenerateAPIKey()
	apiKey := fmt.Sprintf("dp_live_%s", keyBody)

	// 提取后缀 (取最后8个字符)
	keySuffix := keyBody[len(keyBody)-8:]
	if len(keyBody) < 8 {
		keySuffix = keyBody
	}

	appAPIKey := &models.AppAPIKey{
		AppID:     app.ID,
		Name:      "默认密钥",
		KeyHash:   utils.HashString(apiKey),
		KeyPrefix: "dp_live_",
		KeySuffix: keySuffix,
		Status:    1,
	}
	if err := tx.Create(appAPIKey).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("API密钥创建失败")
	}

	tx.Commit()
	return app, nil
}

// GetUserApps 获取用户应用列表(仅启用的应用，用于切换器)
func (s *AppService) GetUserApps(userID uint) ([]models.App, error) {
	var apps []models.App

	err := database.DB.Table("apps").
		Select("apps.*, user_app_permissions.role").
		Joins("JOIN user_app_permissions ON apps.id = user_app_permissions.app_id").
		Where("user_app_permissions.user_id = ? AND apps.status = 1", userID).
		Find(&apps).Error

	if err != nil {
		return nil, errors.New("获取应用列表失败")
	}

	return apps, nil
}

// GetAllUserApps 获取用户所有应用列表(包括禁用的，用于管理页面)
func (s *AppService) GetAllUserApps(userID uint) ([]models.App, error) {
	var apps []models.App

	err := database.DB.Table("apps").
		Select("apps.*, user_app_permissions.role").
		Joins("JOIN user_app_permissions ON apps.id = user_app_permissions.app_id").
		Where("user_app_permissions.user_id = ?", userID).
		Find(&apps).Error

	if err != nil {
		return nil, errors.New("获取应用列表失败")
	}

	return apps, nil
}

// GetAppByID 根据ID获取应用
func (s *AppService) GetAppByID(appID uint, userID uint) (*models.App, error) {
	// 检查用户权限
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, appID, "viewer")
	if err != nil {
		return nil, errors.New("权限检查失败")
	}
	if !hasPermission {
		return nil, errors.New("无权限访问该应用")
	}

	var app models.App
	if err := database.DB.Where("id = ?", appID).First(&app).Error; err != nil {
		return nil, errors.New("应用不存在")
	}

	return &app, nil
}

// UpdateApp 更新应用
func (s *AppService) UpdateApp(appID uint, userID uint, updates map[string]interface{}) (*models.App, error) {
	// 检查用户权限 (需要developer以上权限)
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, appID, "developer")
	if err != nil {
		return nil, errors.New("权限检查失败")
	}
	if !hasPermission {
		return nil, errors.New("无权限修改该应用")
	}

	// 获取应用(包括禁用的，因为管理员需要能编辑禁用的应用)
	var app models.App
	if err := database.DB.Where("id = ?", appID).First(&app).Error; err != nil {
		return nil, errors.New("应用不存在")
	}

	// 如果要更新包名，检查包名唯一性
	if packageName, exists := updates["package_name"]; exists {
		packageNameStr := packageName.(string)
		// 只有当包名与当前包名不同时才检查唯一性
		if packageNameStr != app.PackageName {
			var existingApp models.App
			if err := database.DB.Where("package_name = ? AND id != ?", packageNameStr, appID).First(&existingApp).Error; err == nil {
				return nil, errors.New("包名已存在")
			}

			// 使用事务更新应用并同步 iOS APNs 配置的 bundle_id
			tx := database.DB.Begin()
			// 更新应用基本信息
			if err := tx.Model(&app).Updates(updates).Error; err != nil {
				tx.Rollback()
				return nil, errors.New("应用更新失败")
			}

			// 同步所有 iOS APNs 配置中的 bundle_id
			var configs []models.AppConfig
			if err := tx.Where("app_id = ? AND platform = ? AND channel = ?", appID, "ios", "apns").Find(&configs).Error; err != nil {
				tx.Rollback()
				return nil, errors.New("推送配置同步失败")
			}
			for i := range configs {
				var cfg map[string]interface{}
				if err := json.Unmarshal([]byte(configs[i].Config), &cfg); err != nil {
					// 配置JSON异常时跳过该条，避免整体失败
					continue
				}
				cfg["bundle_id"] = packageNameStr
				if b, err := json.Marshal(cfg); err == nil {
					configs[i].Config = string(b)
					if err := tx.Save(&configs[i]).Error; err != nil {
						tx.Rollback()
						return nil, errors.New("推送配置同步失败")
					}
				} else {
					// 序列化异常时跳过该条
					continue
				}
			}

			if err := tx.Commit().Error; err != nil {
				return nil, errors.New("应用更新失败")
			}

			return &app, nil
		}
	}

	// 更新应用
	if err := database.DB.Model(&app).Updates(updates).Error; err != nil {
		return nil, errors.New("应用更新失败")
	}

	return &app, nil
}

// DeleteApp 删除应用
func (s *AppService) DeleteApp(appID uint, userID uint) error {
	// 检查用户权限 (需要owner权限)
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, appID, "owner")
	if err != nil {
		return errors.New("权限检查失败")
	}
	if !hasPermission {
		return errors.New("无权限删除该应用")
	}

	// 软删除应用
	if err := database.DB.Model(&models.App{}).Where("id = ?", appID).Update("status", 0).Error; err != nil {
		return errors.New("应用删除失败")
	}

	return nil
}

// GetAppAPIKeys 获取应用API密钥列表
func (s *AppService) GetAppAPIKeys(appID uint, userID uint) ([]models.AppAPIKey, error) {
	// 检查用户权限
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, appID, "viewer")
	if err != nil {
		return nil, errors.New("权限检查失败")
	}
	if !hasPermission {
		return nil, errors.New("无权限访问该应用")
	}

	var apiKeys []models.AppAPIKey
	if err := database.DB.Where("app_id = ? AND status = 1", appID).Find(&apiKeys).Error; err != nil {
		return nil, errors.New("获取API密钥失败")
	}

	return apiKeys, nil
}

// CreateAPIKey 创建API密钥
func (s *AppService) CreateAPIKey(appID uint, userID uint, name string) (*models.AppAPIKey, string, error) {
	// 检查用户权限 (需要developer以上权限)
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, appID, "developer")
	if err != nil {
		return nil, "", errors.New("权限检查失败")
	}
	if !hasPermission {
		return nil, "", errors.New("无权限创建API密钥")
	}

	// 生成API密钥
	keyBody := utils.GenerateAPIKey()
	apiKey := fmt.Sprintf("dp_live_%s", keyBody)

	// 提取后缀 (取最后8个字符)
	keySuffix := keyBody[len(keyBody)-8:]
	if len(keyBody) < 8 {
		keySuffix = keyBody
	}

	appAPIKey := &models.AppAPIKey{
		AppID:     appID,
		Name:      name,
		KeyHash:   utils.HashString(apiKey),
		KeyPrefix: "dp_live_",
		KeySuffix: keySuffix,
		Status:    1,
	}

	if err := database.DB.Create(appAPIKey).Error; err != nil {
		return nil, "", errors.New("API密钥创建失败")
	}

	return appAPIKey, apiKey, nil
}

// DeleteAPIKey 删除API密钥
func (s *AppService) DeleteAPIKey(appID uint, keyID uint, userID uint) error {
	// 检查用户权限 (需要developer以上权限)
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, appID, "developer")
	if err != nil {
		return errors.New("权限检查失败")
	}
	if !hasPermission {
		return errors.New("无权限删除API密钥")
	}

	// 检查API密钥是否存在且属于指定应用
	var apiKey models.AppAPIKey
	if err := database.DB.Where("id = ? AND app_id = ?", keyID, appID).First(&apiKey).Error; err != nil {
		return errors.New("API密钥不存在")
	}

	// 软删除API密钥
	if err := database.DB.Delete(&apiKey).Error; err != nil {
		return errors.New("删除API密钥失败")
	}

	return nil
}
