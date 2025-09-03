package controllers

import (
	"net/http"
	"strconv"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// AppController 应用控制器
type AppController struct {
	appService   *services.AppService
	auditService *services.AuditService
}

// NewAppController 创建应用控制器
func NewAppController() *AppController {
	return &AppController{
		appService:   services.NewAppService(),
		auditService: services.NewAuditService(),
	}
}

// CreateAppRequest 创建应用请求
type CreateAppRequest struct {
	Name        string `json:"name" binding:"required,max=100" example:"我的应用"`
	PackageName string `json:"package_name" binding:"required,max=100" example:"com.example.app"`
	Description string `json:"description" example:"应用描述"`
	Platform    string `json:"platform" binding:"required,oneof=ios android both" example:"both"`
	AppIcon     string `json:"app_icon" example:"/uploads/icons/app_icon_123456.png"`
}

// UpdateAppRequest 更新应用请求
type UpdateAppRequest struct {
	Name        string `json:"name" binding:"omitempty,max=100" example:"我的应用"`
	PackageName string `json:"package_name" binding:"omitempty,max=100" example:"com.example.app"`
	Description string `json:"description" example:"应用描述"`
	Platform    string `json:"platform" binding:"omitempty,oneof=ios android both" example:"both"`
	AppIcon     string `json:"app_icon" example:"/uploads/icons/app_icon_123456.png"`
	Status      *int   `json:"status" binding:"omitempty,oneof=0 1" example:"1"`
}

// CreateAPIKeyRequest 创建API密钥请求
type CreateAPIKeyRequest struct {
	Name string `json:"name" binding:"required,max=100" example:"生产环境密钥"`
}

// CreateAPIKeyResponse 创建API密钥响应
type CreateAPIKeyResponse struct {
	APIKey  string      `json:"api_key" example:"dp_live_abc123..."`
	KeyInfo interface{} `json:"key_info"`
	Warning string      `json:"warning" example:"请妥善保存API密钥，再次获取将无法查看完整密钥"`
}

// CreateApp 创建应用
// @Summary 创建应用
// @Description 创建新的推送应用
// @Tags 应用管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateAppRequest true "应用信息"
// @Success 201 {object} response.APIResponse{data=models.App}
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 422 {object} response.APIResponse
// @Router /apps [post]
func (a *AppController) CreateApp(c *gin.Context) {
	var req CreateAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	userID := c.GetUint("user_id")
	apps, err := a.appService.GetAllUserApps(userID)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	if len(apps) >= 50 {
		response.BadRequest(c, "最多创建50个应用")
		return
	}

	app, err := a.appService.CreateApp(userID, req.Name, req.PackageName, req.Description, req.Platform, req.AppIcon)
	if err != nil {
		response.Error(c, http.StatusUnprocessableEntity, err.Error())
		return
	}

	// 记录审计日志
	go func() {
		ipAddress := c.ClientIP()
		userAgent := c.GetHeader("User-Agent")
		err := a.auditService.LogActionWithBeforeAfter(
			userID,
			&app.ID,
			"create",
			"app",
			strconv.FormatUint(uint64(app.ID), 10),
			nil, // 创建操作没有变更前数据
			req, // 创建请求作为变更后数据
			ipAddress,
			userAgent,
		)
		if err != nil {
			// 审计记录失败不影响主流程，可以记录到错误日志
		}
	}()

	c.JSON(http.StatusCreated, response.APIResponse{
		Code:    201,
		Message: "应用创建成功",
		Data:    app,
	})
}

// GetApps 获取应用列表
// @Summary 获取应用列表
// @Description 获取当前用户有权限的应用列表(包括禁用的应用)
// @Tags 应用管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.APIResponse{data=[]models.App}
// @Failure 401 {object} response.APIResponse
// @Router /apps [get]
func (a *AppController) GetApps(c *gin.Context) {
	userID := c.GetUint("user_id")
	apps, err := a.appService.GetAllUserApps(userID)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}

	response.Success(c, apps)
}

// GetApp 获取应用详情
// @Summary 获取应用详情
// @Description 根据应用ID获取应用详细信息
// @Tags 应用管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Success 200 {object} response.APIResponse{data=models.App}
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /apps/{appId} [get]
func (a *AppController) GetApp(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	userID := c.GetUint("user_id")
	app, err := a.appService.GetAppByID(uint(appID), userID)
	if err != nil {
		if err.Error() == "无权限访问该应用" {
			response.Forbidden(c, err.Error())
		} else {
			response.NotFound(c, err.Error())
		}
		return
	}

	response.Success(c, app)
}

// UpdateApp 更新应用
// @Summary 更新应用
// @Description 更新应用信息，包括应用名称、包名、描述、平台、图标和状态
// @Tags 应用管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param request body UpdateAppRequest true "更新信息"
// @Success 200 {object} response.APIResponse{data=models.App}
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Failure 422 {object} response.APIResponse
// @Router /apps/{appId} [put]
func (a *AppController) UpdateApp(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	var req UpdateAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	// 构建更新数据
	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.PackageName != "" {
		updates["package_name"] = req.PackageName
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Platform != "" {
		updates["platform"] = req.Platform
	}
	if req.AppIcon != "" {
		updates["app_icon"] = req.AppIcon
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	userID := c.GetUint("user_id")

	// 获取更新前的应用信息用于审计
	oldApp, _ := a.appService.GetAppByID(uint(appID), userID)

	app, err := a.appService.UpdateApp(uint(appID), userID, updates)
	if err != nil {
		if err.Error() == "无权限修改该应用" {
			response.Forbidden(c, err.Error())
		} else {
			response.NotFound(c, err.Error())
		}
		return
	}

	// 记录审计日志
	go func() {
		ipAddress := c.ClientIP()
		userAgent := c.GetHeader("User-Agent")
		err := a.auditService.LogActionWithBeforeAfter(
			userID,
			&app.ID,
			"update",
			"app",
			strconv.FormatUint(uint64(app.ID), 10),
			oldApp, // 更新前的应用信息
			req,    // 更新请求数据
			ipAddress,
			userAgent,
		)
		if err != nil {
			// 审计记录失败不影响主流程
		}
	}()

	response.Success(c, app)
}

// DeleteApp 删除应用
// @Summary 删除应用
// @Description 删除应用 (软删除)
// @Tags 应用管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Success 200 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /apps/{appId} [delete]
func (a *AppController) DeleteApp(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	userID := c.GetUint("user_id")

	// 获取删除前的应用信息用于审计
	deletedApp, _ := a.appService.GetAppByID(uint(appID), userID)

	if err := a.appService.DeleteApp(uint(appID), userID); err != nil {
		if err.Error() == "无权限删除该应用" {
			response.Forbidden(c, err.Error())
		} else {
			response.NotFound(c, err.Error())
		}
		return
	}

	// 记录审计日志
	go func() {
		ipAddress := c.ClientIP()
		userAgent := c.GetHeader("User-Agent")
		err := a.auditService.LogActionWithBeforeAfter(
			userID,
			&deletedApp.ID,
			"delete",
			"app",
			strconv.FormatUint(uint64(deletedApp.ID), 10),
			deletedApp, // 删除前的应用信息
			nil,        // 删除操作没有变更后数据
			ipAddress,
			userAgent,
		)
		if err != nil {
			// 审计记录失败不影响主流程
		}
	}()

	response.Success(c, gin.H{"message": "应用删除成功"})
}

// GetAppAPIKeys 获取应用API密钥
// @Summary 获取应用API密钥
// @Description 获取应用的API密钥列表
// @Tags 应用管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Success 200 {object} response.APIResponse{data=[]models.AppAPIKey}
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Router /apps/{appId}/api-keys [get]
func (a *AppController) GetAppAPIKeys(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	userID := c.GetUint("user_id")
	apiKeys, err := a.appService.GetAppAPIKeys(uint(appID), userID)
	if err != nil {
		if err.Error() == "无权限访问该应用" {
			response.Forbidden(c, err.Error())
		} else {
			response.InternalServerError(c, err.Error())
		}
		return
	}

	response.Success(c, apiKeys)
}

// CreateAPIKey 创建API密钥
// @Summary 创建API密钥
// @Description 为应用创建新的API密钥
// @Tags 应用管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param request body CreateAPIKeyRequest true "密钥信息"
// @Success 201 {object} response.APIResponse{data=CreateAPIKeyResponse}
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Router /apps/{appId}/api-keys [post]
func (a *AppController) CreateAPIKey(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	var req CreateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	userID := c.GetUint("user_id")
	keyInfo, apiKey, err := a.appService.CreateAPIKey(uint(appID), userID, req.Name)
	if err != nil {
		if err.Error() == "无权限创建API密钥" {
			response.Forbidden(c, err.Error())
		} else {
			response.InternalServerError(c, err.Error())
		}
		return
	}

	// 记录审计日志
	go func() {
		ipAddress := c.ClientIP()
		userAgent := c.GetHeader("User-Agent")
		appIDUint := uint(appID)
		err := a.auditService.LogActionWithBeforeAfter(
			userID,
			&appIDUint,
			"create",
			"api_key",
			strconv.FormatUint(uint64(keyInfo.ID), 10),
			nil, // 创建操作没有变更前数据
			gin.H{
				"name":            req.Name,
				"key_prefix":      keyInfo.KeyPrefix,
				"key_suffix":      keyInfo.KeySuffix,
				"created_for_app": appID,
			}, // API密钥创建信息（不包含完整密钥）
			ipAddress,
			userAgent,
		)
		if err != nil {
			// 审计记录失败不影响主流程
		}
	}()

	c.JSON(http.StatusCreated, response.APIResponse{
		Code:    201,
		Message: "API密钥创建成功",
		Data: CreateAPIKeyResponse{
			APIKey:  apiKey,
			KeyInfo: keyInfo,
			Warning: "请妥善保存API密钥，再次获取将无法查看完整密钥",
		},
	})
}

// DeleteAPIKey 删除API密钥
// @Summary 删除API密钥
// @Description 删除应用的API密钥
// @Tags 应用管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param keyId path int true "密钥ID"
// @Success 200 {object} response.APIResponse
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /apps/{appId}/api-keys/{keyId} [delete]
func (a *AppController) DeleteAPIKey(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	keyID, err := strconv.ParseUint(c.Param("keyId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的密钥ID")
		return
	}

	userID := c.GetUint("user_id")

	// 获取删除前的API密钥信息用于审计（不包含敏感信息）
	deletedKeyInfo := gin.H{
		"app_id": appID,
		"key_id": keyID,
	}

	if err := a.appService.DeleteAPIKey(uint(appID), uint(keyID), userID); err != nil {
		if err.Error() == "无权限删除API密钥" {
			response.Forbidden(c, err.Error())
		} else if err.Error() == "API密钥不存在" {
			response.NotFound(c, err.Error())
		} else {
			response.InternalServerError(c, err.Error())
		}
		return
	}

	// 记录审计日志
	go func() {
		ipAddress := c.ClientIP()
		userAgent := c.GetHeader("User-Agent")
		appIDUint := uint(appID)
		err := a.auditService.LogActionWithBeforeAfter(
			userID,
			&appIDUint,
			"delete",
			"api_key",
			strconv.FormatUint(uint64(keyID), 10),
			deletedKeyInfo, // 删除前的API密钥信息
			nil,            // 删除操作没有变更后数据
			ipAddress,
			userAgent,
		)
		if err != nil {
			// 审计记录失败不影响主流程
		}
	}()

	response.Success(c, gin.H{"message": "API密钥删除成功"})
}
