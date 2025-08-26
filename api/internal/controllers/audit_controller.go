package controllers

import (
	"strconv"
	"time"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// AuditController 审计日志控制器
type AuditController struct {
	auditService *services.AuditService
}

// NewAuditController 创建审计控制器
func NewAuditController() *AuditController {
	return &AuditController{
		auditService: services.NewAuditService(),
	}
}

// GetGlobalAuditLogs 获取全局审计日志
// @Summary 获取全局审计日志
// @Description 获取全局审计日志，需要管理员权限
// @Tags 审计日志
// @Accept json
// @Produce json
// @Param user_id query int false "用户ID筛选"
// @Param action query string false "操作类型筛选" Enums(create, update, delete, push)
// @Param resource query string false "资源类型筛选" Enums(app, device, push, config, template, group, scheduled_push)
// @Param start_time query string false "开始时间" example(2024-01-01T00:00:00Z)
// @Param end_time query string false "结束时间" example(2024-01-31T23:59:59Z)
// @Param page query int false "页码" example(1)
// @Param page_size query int false "每页数量" example(20)
// @Success 200 {object} response.APIResponse{data=[]models.AuditLog} "审计日志列表"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /audit-logs [get]
func (ctrl *AuditController) GetGlobalAuditLogs(ctx *gin.Context) {
	// TODO: 验证管理员权限
	currentUserID := ctx.GetUint("user_id")
	if currentUserID == 0 {
		response.Unauthorized(ctx, "用户信息获取失败")
		return
	}

	// 解析查询参数
	userIDStr := ctx.Query("user_id")
	var userID uint
	if userIDStr != "" {
		if id, err := strconv.ParseUint(userIDStr, 10, 64); err == nil {
			userID = uint(id)
		}
	}

	action := ctx.Query("action")
	resource := ctx.Query("resource")

	var startTime, endTime *time.Time
	if startTimeStr := ctx.Query("start_time"); startTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
			startTime = &t
		}
	}
	if endTimeStr := ctx.Query("end_time"); endTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, endTimeStr); err == nil {
			endTime = &t
		}
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	logs, total, err := ctrl.auditService.GetGlobalAuditLogs(userID, action, resource, startTime, endTime, page, pageSize)
	if err != nil {
		response.InternalServerError(ctx, "获取审计日志失败")
		return
	}

	response.Success(ctx, gin.H{
		"logs":      logs,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetAppAuditLogs 获取应用审计日志
// @Summary 获取应用审计日志
// @Description 获取指定应用的审计日志
// @Tags 审计日志
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param user_id query int false "用户ID筛选"
// @Param action query string false "操作类型筛选" Enums(create, update, delete, push)
// @Param resource query string false "资源类型筛选" Enums(device, push, config, template, group, scheduled_push)
// @Param start_time query string false "开始时间" example(2024-01-01T00:00:00Z)
// @Param end_time query string false "结束时间" example(2024-01-31T23:59:59Z)
// @Param page query int false "页码" example(1)
// @Param page_size query int false "每页数量" example(20)
// @Success 200 {object} response.APIResponse{data=[]models.AuditLog} "审计日志列表"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/audit-logs [get]
func (ctrl *AuditController) GetAppAuditLogs(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	// 解析查询参数
	userIDStr := ctx.Query("user_id")
	var userID uint
	if userIDStr != "" {
		if id, err := strconv.ParseUint(userIDStr, 10, 64); err == nil {
			userID = uint(id)
		}
	}

	action := ctx.Query("action")
	resource := ctx.Query("resource")

	var startTime, endTime *time.Time
	if startTimeStr := ctx.Query("start_time"); startTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
			startTime = &t
		}
	}
	if endTimeStr := ctx.Query("end_time"); endTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, endTimeStr); err == nil {
			endTime = &t
		}
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	logs, total, err := ctrl.auditService.GetAppAuditLogs(uint(appID), userID, action, resource, startTime, endTime, page, pageSize)
	if err != nil {
		response.InternalServerError(ctx, "获取应用审计日志失败")
		return
	}

	response.Success(ctx, gin.H{
		"logs":      logs,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetActionStatistics 获取操作统计
// @Summary 获取操作统计
// @Description 获取操作统计数据，用于监控分析
// @Tags 审计日志
// @Accept json
// @Produce json
// @Param appId path int false "应用ID，为空则获取全局统计"
// @Param days query int false "统计天数" example(30)
// @Success 200 {object} response.APIResponse{data=[]services.ActionStatistic} "操作统计数据"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Router /audit-logs/statistics [get]
func (ctrl *AuditController) GetActionStatistics(ctx *gin.Context) {
	appIDStr := ctx.Query("app_id")
	var appID *uint
	if appIDStr != "" {
		if id, err := strconv.ParseUint(appIDStr, 10, 64); err == nil {
			appIDValue := uint(id)
			appID = &appIDValue
		}
	}

	days, _ := strconv.Atoi(ctx.DefaultQuery("days", "30"))
	if days < 1 || days > 365 {
		days = 30
	}

	stats, err := ctrl.auditService.GetActionStatistics(appID, days)
	if err != nil {
		response.InternalServerError(ctx, "获取操作统计失败")
		return
	}

	response.Success(ctx, stats)
}
