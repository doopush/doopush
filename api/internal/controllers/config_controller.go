package controllers

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/internal/push"
	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// ConfigController 配置控制器
type ConfigController struct{}

// NewConfigController 创建配置控制器
func NewConfigController() *ConfigController {
	return &ConfigController{}
}

// SetConfigRequest 设置配置请求
type SetConfigRequest struct {
	Platform string `json:"platform" binding:"required,oneof=ios android" example:"ios"`
	Channel  string `json:"channel" binding:"required" example:"apns"`
	Config   string `json:"config" binding:"required" example:"{\"cert_pem\":\"...\"}"`
}

// SetAppConfig 设置应用配置
// @Summary 设置应用配置
// @Description 设置应用的推送服务配置 (如APNs证书、Android密钥等)
// @Tags 应用配置
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param request body SetConfigRequest true "配置信息"
// @Success 200 {object} response.APIResponse{data=models.AppConfig}
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Router /apps/{appId}/config [post]
func (c *ConfigController) SetAppConfig(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	var req SetConfigRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, "请求参数错误: "+err.Error())
		return
	}

	// 检查用户权限 (需要developer以上权限)
	userID := ctx.GetUint("user_id")
	userService := services.NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, uint(appID), "developer")
	if err != nil {
		response.InternalServerError(ctx, "权限检查失败")
		return
	}
	if !hasPermission {
		response.Forbidden(ctx, "无权限修改应用配置")
		return
	}

	// iOS APNs：验证 bundle_id 必须存在且与应用包名一致
	if req.Platform == "ios" && req.Channel == "apns" {
		var cfg map[string]interface{}
		if err := json.Unmarshal([]byte(req.Config), &cfg); err != nil {
			response.BadRequest(ctx, "配置数据格式错误")
			return
		}
		bundleID, _ := cfg["bundle_id"].(string)
		if bundleID == "" {
			response.BadRequest(ctx, "缺少 bundle_id")
			return
		}
		var app models.App
		if err := database.DB.Where("id = ?", appID).First(&app).Error; err != nil {
			response.NotFound(ctx, "应用不存在")
			return
		}
		if bundleID != app.PackageName {
			response.BadRequest(ctx, "Bundle ID 与应用包名不一致")
			return
		}
	}

	// 更新或创建配置
	var appConfig models.AppConfig
	err = database.DB.Where("app_id = ? AND platform = ? AND channel = ?", appID, req.Platform, req.Channel).First(&appConfig).Error

	if err != nil {
		// 创建新配置
		appConfig = models.AppConfig{
			AppID:    uint(appID),
			Platform: req.Platform,
			Channel:  req.Channel,
			Config:   req.Config,
		}
		if err := database.DB.Create(&appConfig).Error; err != nil {
			response.InternalServerError(ctx, "配置创建失败")
			return
		}
	} else {
		// 更新现有配置
		appConfig.Config = req.Config
		if err := database.DB.Save(&appConfig).Error; err != nil {
			response.InternalServerError(ctx, "配置更新失败")
			return
		}
	}

	response.Success(ctx, appConfig)
}

// GetAppConfigs 获取应用配置列表
// @Summary 获取应用配置
// @Description 获取应用的推送服务配置列表
// @Tags 应用配置
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Success 200 {object} response.APIResponse{data=[]models.AppConfig}
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Router /apps/{appId}/config [get]
func (c *ConfigController) GetAppConfigs(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	// 检查用户权限
	userID := ctx.GetUint("user_id")
	userService := services.NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, uint(appID), "viewer")
	if err != nil {
		response.InternalServerError(ctx, "权限检查失败")
		return
	}
	if !hasPermission {
		response.Forbidden(ctx, "无权限访问该应用")
		return
	}

	var configs []models.AppConfig
	if err := database.DB.Where("app_id = ?", appID).Find(&configs).Error; err != nil {
		response.InternalServerError(ctx, "获取配置失败")
		return
	}

	// 对于敏感配置，隐藏相关的密钥字段
	for i := range configs {
		var configMap map[string]interface{}
		if err := json.Unmarshal([]byte(configs[i].Config), &configMap); err == nil {
			modified := false

			// iOS配置：隐藏private_key
			if configs[i].Platform == "ios" {
				if _, exists := configMap["private_key"]; exists {
					configMap["private_key"] = "[REDACTED]"
					modified = true
				}
			}

			// Android配置：隐藏各种secret字段
			if configs[i].Platform == "android" {
				// FCM: 隐藏server_key
				if _, exists := configMap["server_key"]; exists {
					configMap["server_key"] = "[REDACTED]"
					modified = true
				}
				// 华为、小米、VIVO等：隐藏app_secret
				if _, exists := configMap["app_secret"]; exists {
					configMap["app_secret"] = "[REDACTED]"
					modified = true
				}
				// OPPO：隐藏master_secret
				if _, exists := configMap["master_secret"]; exists {
					configMap["master_secret"] = "[REDACTED]"
					modified = true
				}
			}

			// 如果有修改，更新配置字符串
			if modified {
				if configBytes, err := json.Marshal(configMap); err == nil {
					configs[i].Config = string(configBytes)
				}
			}
		}
	}

	response.Success(ctx, configs)
}

// TestConfigRequest 测试配置请求
type TestConfigRequest struct {
	Platform    string `json:"platform" binding:"required,oneof=ios android" example:"ios"`
	Channel     string `json:"channel" binding:"required" example:"apns"`
	DeviceID    string `json:"device_id" binding:"required" example:"test_device"`
	TestTitle   string `json:"test_title" example:"配置测试"`
	TestContent string `json:"test_content" example:"这是一条测试推送消息"`
}

// TestAppConfig 测试应用配置
// @Summary 测试应用配置
// @Description 测试指定应用的推送配置是否正常工作
// @Tags 应用配置
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param test body TestConfigRequest true "测试请求"
// @Success 200 {object} response.APIResponse{data=object} "测试结果"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/config/test [post]
func (ctrl *ConfigController) TestAppConfig(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	var req TestConfigRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	// 查找对应的配置
	var appConfig models.AppConfig
	err = database.DB.Where("app_id = ? AND platform = ? AND channel = ?",
		appID, req.Platform, req.Channel).First(&appConfig).Error

	if err != nil {
		response.BadRequest(ctx, "找不到对应的推送配置")
		return
	}

	// 检查用户权限（需要developer权限才能测试）
	userID := ctx.GetUint("user_id")
	userService := services.NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, uint(appID), "developer")
	if err != nil {
		response.InternalServerError(ctx, "权限检查失败")
		return
	}
	if !hasPermission {
		response.Forbidden(ctx, "需要开发者权限才能测试推送配置")
		return
	}

	// 基本配置验证
	if appConfig.Config == "" {
		response.BadRequest(ctx, "配置为空，请先配置推送参数")
		return
	}

	// 创建推送管理器进行真实测试
	pushManager := push.NewPushManager()

	// 执行真实推送测试
	result := pushManager.TestConfigWithDevice(
		uint(appID),
		req.TestTitle,
		req.TestContent,
		req.Platform,
		req.Channel,
		req.DeviceID,
		appConfig.Config,
	)

	// 构建响应数据
	testResult := gin.H{
		"success":     result.Success,
		"platform":    req.Platform,
		"channel":     req.Channel,
		"test_device": req.DeviceID,
		"config_id":   appConfig.ID,
		"test_time":   time.Now().Format(time.RFC3339),
	}

	if result.Success {
		testResult["message"] = "配置测试成功，推送已发送"
		if req.TestTitle != "" {
			testResult["test_title"] = req.TestTitle
		}
		if req.TestContent != "" {
			testResult["test_content"] = req.TestContent
		}
	} else {
		testResult["message"] = "配置测试失败: " + result.ErrorMessage
		testResult["error_code"] = result.ErrorCode
	}

	response.Success(ctx, testResult)
}

// UpdateConfigRequest 更新配置请求
type UpdateConfigRequest struct {
	Config string `json:"config" binding:"required" example:"{\"cert_pem\":\"...\"}"`
}

// UpdateAppConfig 更新应用配置
// @Summary 更新应用配置
// @Description 更新指定应用的推送服务配置
// @Tags 应用配置
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param configId path int true "配置ID"
// @Param request body UpdateConfigRequest true "配置信息"
// @Success 200 {object} response.APIResponse{data=models.AppConfig}
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /apps/{appId}/config/{configId} [put]
func (c *ConfigController) UpdateAppConfig(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	configID, err := strconv.ParseUint(ctx.Param("configId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "无效的配置ID")
		return
	}

	var req UpdateConfigRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, "请求参数错误: "+err.Error())
		return
	}

	// 检查用户权限 (需要developer以上权限)
	userID := ctx.GetUint("user_id")
	userService := services.NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, uint(appID), "developer")
	if err != nil {
		response.InternalServerError(ctx, "权限检查失败")
		return
	}
	if !hasPermission {
		response.Forbidden(ctx, "无权限修改应用配置")
		return
	}

	// 检查配置是否存在且属于指定应用
	var appConfig models.AppConfig
	err = database.DB.Where("id = ? AND app_id = ?", configID, appID).First(&appConfig).Error
	if err != nil {
		response.NotFound(ctx, "配置不存在")
		return
	}

	// 处理更新的配置，过滤隐藏字段标记
	var newConfigMap map[string]interface{}
	if err := json.Unmarshal([]byte(req.Config), &newConfigMap); err != nil {
		response.BadRequest(ctx, "配置数据格式错误")
		return
	}

	// iOS APNs：验证 bundle_id 必须与应用包名一致
	if appConfig.Platform == "ios" && appConfig.Channel == "apns" {
		bundleID, _ := newConfigMap["bundle_id"].(string)
		if bundleID == "" {
			response.BadRequest(ctx, "缺少 bundle_id")
			return
		}
		var app models.App
		if err := database.DB.Where("id = ?", appID).First(&app).Error; err != nil {
			response.NotFound(ctx, "应用不存在")
			return
		}
		if bundleID != app.PackageName {
			response.BadRequest(ctx, "Bundle ID 与应用包名不一致")
			return
		}
	}

	// 获取原始配置数据
	var originalConfigMap map[string]interface{}
	if err := json.Unmarshal([]byte(appConfig.Config), &originalConfigMap); err != nil {
		response.InternalServerError(ctx, "原始配置数据格式错误")
		return
	}

	// 过滤隐藏字段标记，保持原有值
	for key, value := range newConfigMap {
		if strVal, ok := value.(string); ok && strVal == "[REDACTED]" {
			// 如果新值是隐藏标记，使用原始值
			if originalVal, exists := originalConfigMap[key]; exists {
				newConfigMap[key] = originalVal
			}
		}
	}

	// 重新生成配置JSON
	if configBytes, err := json.Marshal(newConfigMap); err != nil {
		response.InternalServerError(ctx, "配置数据序列化失败")
		return
	} else {
		appConfig.Config = string(configBytes)
	}

	// 更新配置
	if err := database.DB.Save(&appConfig).Error; err != nil {
		response.InternalServerError(ctx, "配置更新失败")
		return
	}

	response.Success(ctx, appConfig)
}

// DeleteAppConfig 删除应用配置
// @Summary 删除应用配置
// @Description 删除应用的推送服务配置
// @Tags 应用配置
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param configId path int true "配置ID"
// @Success 200 {object} response.APIResponse
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /apps/{appId}/config/{configId} [delete]
func (c *ConfigController) DeleteAppConfig(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	configID, err := strconv.ParseUint(ctx.Param("configId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "无效的配置ID")
		return
	}

	// 检查用户权限 (需要developer以上权限)
	userID := ctx.GetUint("user_id")
	userService := services.NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, uint(appID), "developer")
	if err != nil {
		response.InternalServerError(ctx, "权限检查失败")
		return
	}
	if !hasPermission {
		response.Forbidden(ctx, "无权限删除应用配置")
		return
	}

	// 检查配置是否存在且属于指定应用
	var appConfig models.AppConfig
	err = database.DB.Where("id = ? AND app_id = ?", configID, appID).First(&appConfig).Error
	if err != nil {
		response.NotFound(ctx, "配置不存在")
		return
	}

	// 删除配置
	if err := database.DB.Delete(&appConfig).Error; err != nil {
		response.InternalServerError(ctx, "删除配置失败")
		return
	}

	response.Success(ctx, gin.H{"message": "配置删除成功"})
}
