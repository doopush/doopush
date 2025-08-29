package controllers

import (
	"strconv"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/doopush/doopush/api/pkg/utils"
	"github.com/gin-gonic/gin"
)

// TemplateController 消息模板控制器
type TemplateController struct {
	templateService *services.TemplateService
}

// NewTemplateController 创建模板控制器
func NewTemplateController() *TemplateController {
	return &TemplateController{
		templateService: services.NewTemplateService(),
	}
}

// CreateTemplateRequest 创建模板请求
type CreateTemplateRequest struct {
	Name      string                               `json:"name" binding:"required" example:"welcome_template"`
	Title     string                               `json:"title" binding:"required" example:"欢迎 {{username}}"`
	Content   string                               `json:"content" binding:"required" example:"欢迎使用我们的应用，{{username}}！"`
	Platform  string                               `json:"platform" binding:"required,oneof=ios android all" example:"all"`
	Locale    string                               `json:"locale" binding:"required" example:"zh-CN"`
	Variables map[string]services.TemplateVariable `json:"variables"`
}

// UpdateTemplateRequest 更新模板请求
type UpdateTemplateRequest struct {
	Name      string                               `json:"name" binding:"required"`
	Title     string                               `json:"title" binding:"required"`
	Content   string                               `json:"content" binding:"required"`
	Platform  string                               `json:"platform" binding:"required,oneof=ios android all"`
	Locale    string                               `json:"locale" binding:"required"`
	Variables map[string]services.TemplateVariable `json:"variables"`
	IsActive  bool                                 `json:"is_active"`
}

// CreateTemplate 创建消息模板
// @Summary 创建消息模板
// @Description 创建一个新的消息模板，支持变量占位符
// @Tags 消息模板
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param template body CreateTemplateRequest true "模板信息"
// @Success 200 {object} response.APIResponse{data=models.MessageTemplate} "模板创建成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 500 {object} response.APIResponse "服务器内部错误"
// @Router /apps/{appId}/templates [post]
func (ctrl *TemplateController) CreateTemplate(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	userID := ctx.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(ctx, "用户信息获取失败")
		return
	}

	var req CreateTemplateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	template, err := ctrl.templateService.CreateTemplate(
		uint(appID), userID, req.Name, req.Title, req.Content,
		req.Platform, req.Locale, req.Variables,
	)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, template)
}

// GetTemplates 获取模板列表
// @Summary 获取模板列表
// @Description 获取指定应用的消息模板列表，支持平台和语言筛选
// @Tags 消息模板
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param platform query string false "平台筛选" Enums(ios, android, all)
// @Param locale query string false "语言筛选" example(zh-CN)
// @Param page query int false "页码" example(1)
// @Param page_size query int false "每页数量" example(20)
// @Success 200 {object} response.APIResponse{data=[]models.MessageTemplate} "模板列表"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/templates [get]
func (ctrl *TemplateController) GetTemplates(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	platform := ctx.Query("platform")
	locale := ctx.Query("locale")
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	templates, total, err := ctrl.templateService.GetTemplates(uint(appID), platform, locale, page, pageSize)
	if err != nil {
		response.InternalServerError(ctx, "获取模板列表失败")
		return
	}

	response.Success(ctx, utils.NewPaginationResponse(page, pageSize, total, gin.H{
		"items": templates,
	}))
}

// GetTemplate 获取模板详情
// @Summary 获取模板详情
// @Description 获取指定模板的详细信息
// @Tags 消息模板
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "模板ID"
// @Success 200 {object} response.APIResponse{data=models.MessageTemplate} "模板详情"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "模板不存在"
// @Router /apps/{appId}/templates/{id} [get]
func (ctrl *TemplateController) GetTemplate(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	templateID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的模板ID")
		return
	}

	template, err := ctrl.templateService.GetTemplate(uint(appID), uint(templateID))
	if err != nil {
		response.NotFound(ctx, err.Error())
		return
	}

	response.Success(ctx, template)
}

// UpdateTemplate 更新模板
// @Summary 更新消息模板
// @Description 更新指定模板的信息，会自动增加版本号
// @Tags 消息模板
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "模板ID"
// @Param template body UpdateTemplateRequest true "模板信息"
// @Success 200 {object} response.APIResponse{data=models.MessageTemplate} "模板更新成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "模板不存在"
// @Router /apps/{appId}/templates/{id} [put]
func (ctrl *TemplateController) UpdateTemplate(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	templateID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的模板ID")
		return
	}

	var req UpdateTemplateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	template, err := ctrl.templateService.UpdateTemplate(
		uint(appID), uint(templateID), req.Name, req.Title, req.Content,
		req.Platform, req.Locale, req.Variables, req.IsActive,
	)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, template)
}

// DeleteTemplate 删除模板
// @Summary 删除消息模板
// @Description 删除指定的消息模板
// @Tags 消息模板
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "模板ID"
// @Success 200 {object} response.APIResponse "模板删除成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "模板不存在"
// @Router /apps/{appId}/templates/{id} [delete]
func (ctrl *TemplateController) DeleteTemplate(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	templateID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的模板ID")
		return
	}

	err = ctrl.templateService.DeleteTemplate(uint(appID), uint(templateID))
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, gin.H{"message": "模板删除成功"})
}

// RenderTemplateRequest 渲染模板请求
type RenderTemplateRequest struct {
	Data map[string]string `json:"data" binding:"required" example:"{\"username\":\"张三\",\"score\":\"100\"}"`
}

// RenderTemplate 渲染模板预览
// @Summary 渲染模板预览
// @Description 使用提供的数据渲染模板，预览最终效果
// @Tags 消息模板
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "模板ID"
// @Param data body RenderTemplateRequest true "渲染数据"
// @Success 200 {object} response.APIResponse{data=object} "渲染结果"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "模板不存在"
// @Router /apps/{appId}/templates/{id}/render [post]
func (ctrl *TemplateController) RenderTemplate(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	templateID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的模板ID")
		return
	}

	var req RenderTemplateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	template, err := ctrl.templateService.GetTemplate(uint(appID), uint(templateID))
	if err != nil {
		response.NotFound(ctx, err.Error())
		return
	}

	title, content, err := ctrl.templateService.RenderTemplate(template, req.Data)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, gin.H{
		"title":   title,
		"content": content,
		"data":    req.Data,
	})
}
