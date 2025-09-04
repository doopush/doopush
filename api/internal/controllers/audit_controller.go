package controllers

import (
	"strconv"
	"time"

	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// AuditLogDTO 审计日志响应DTO
// @Description 审计日志详细信息，包含关联数据和友好标签
type AuditLogDTO struct {
	models.AuditLog
	AppName       string `json:"app_name,omitempty" example:"测试应用"`     // 应用名称
	ActionLabel   string `json:"action_label,omitempty" example:"创建"`   // 操作类型友好标签
	ResourceLabel string `json:"resource_label,omitempty" example:"设备"` // 资源类型友好标签
}

// AuditFilters 审计日志查询筛选条件
// @Description 审计日志高级筛选条件
type AuditFilters struct {
	UserID    *uint      `json:"user_id,omitempty" example:"1"`                       // 用户ID筛选
	Action    string     `json:"action,omitempty" example:"create"`                   // 操作类型筛选
	Resource  string     `json:"resource,omitempty" example:"device"`                 // 资源类型筛选
	StartTime *time.Time `json:"start_time,omitempty" example:"2024-01-01T00:00:00Z"` // 开始时间
	EndTime   *time.Time `json:"end_time,omitempty" example:"2024-01-31T23:59:59Z"`   // 结束时间
	IPAddress string     `json:"ip_address,omitempty" example:"192.168.1.1"`          // IP地址筛选
	UserName  string     `json:"user_name,omitempty" example:"admin"`                 // 用户名筛选
	AppID     *uint      `json:"app_id,omitempty" example:"1"`                        // 应用ID筛选
}

// OperationStat 操作统计数据
// @Description 操作类型统计信息，用于分析监控
type OperationStat struct {
	Action        string `json:"action" example:"create"`               // 操作类型
	Resource      string `json:"resource" example:"device"`             // 资源类型
	Count         int    `json:"count" example:"25"`                    // 操作次数
	ActionLabel   string `json:"action_label,omitempty" example:"创建"`   // 操作类型友好标签
	ResourceLabel string `json:"resource_label,omitempty" example:"设备"` // 资源类型友好标签
}

// AuditLogListResponse 审计日志列表响应
// @Description 分页审计日志列表响应格式
type AuditLogListResponse struct {
	Logs     []AuditLogDTO `json:"logs"`                   // 审计日志列表
	Total    int64         `json:"total" example:"100"`    // 总记录数
	Page     int           `json:"page" example:"1"`       // 当前页码
	PageSize int           `json:"page_size" example:"20"` // 每页记录数
}

// ToAuditLogDTO 转换为AuditLogDTO
func ToAuditLogDTO(auditLog models.AuditLog) AuditLogDTO {
	dto := AuditLogDTO{
		AuditLog: auditLog,
	}

	// 设置友好的操作标签
	dto.ActionLabel = getActionLabel(auditLog.Action)
	dto.ResourceLabel = getResourceLabel(auditLog.Resource)

	// 如果有关联的App信息，设置应用名称
	if auditLog.App.ID > 0 {
		dto.AppName = auditLog.App.Name
	}

	return dto
}

// getActionLabel 获取操作类型的中文标签
func getActionLabel(action string) string {
	labels := map[string]string{
		"create": "创建",
		"update": "更新",
		"delete": "删除",
		"push":   "推送",
		"login":  "登录",
		"logout": "登出",
	}
	if label, exists := labels[action]; exists {
		return label
	}
	return action
}

// getResourceLabel 获取资源类型的中文标签
func getResourceLabel(resource string) string {
	labels := map[string]string{
		"app":            "应用",
		"device":         "设备",
		"push":           "推送",
		"config":         "配置",
		"template":       "模板",
		"group":          "分组",
		"scheduled_push": "定时推送",
		"user":           "用户",
		"api_key":        "API密钥",
	}
	if label, exists := labels[resource]; exists {
		return label
	}
	return resource
}

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

// GetAppAuditLogs 获取应用审计日志（增强版）
// @Summary 获取应用审计日志
// @Description 获取指定应用的审计日志，支持权限验证和高级筛选
// @Tags 审计日志
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param user_id query int false "用户ID筛选"
// @Param user_name query string false "用户名筛选"
// @Param action query string false "操作类型筛选" Enums(create, update, delete, push, login, logout)
// @Param resource query string false "资源类型筛选" Enums(device, push, config, template, group, scheduled_push, api_key)
// @Param ip_address query string false "IP地址筛选"
// @Param start_time query string false "开始时间" example(2024-01-01T00:00:00Z)
// @Param end_time query string false "结束时间" example(2024-01-31T23:59:59Z)
// @Param page query int false "页码" example(1)
// @Param page_size query int false "每页数量" example(20)
// @Success 200 {object} response.APIResponse{data=AuditLogListResponse} "审计日志列表"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /api/v1/apps/{appId}/audit-logs [get]
func (ctrl *AuditController) GetAppAuditLogs(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	// 权限验证：检查用户是否有权限访问该应用的审计日志
	currentUserID := ctx.GetUint("user_id")
	if currentUserID == 0 {
		response.Unauthorized(ctx, "用户信息获取失败")
		return
	}

	// 使用UserService检查权限
	userService := services.NewUserService()
	hasPermission, err := userService.CheckAppPermission(currentUserID, uint(appID), "viewer")
	if err != nil {
		response.InternalServerError(ctx, "权限检查失败")
		return
	}
	if !hasPermission {
		response.Forbidden(ctx, "无权限访问该应用的审计日志")
		return
	}

	// 构建筛选条件
	filters := services.AuditFilters{}

	// 设置应用ID筛选
	appIDFilter := uint(appID)
	filters.AppID = &appIDFilter

	// 解析用户ID
	if userIDStr := ctx.Query("user_id"); userIDStr != "" {
		if id, err := strconv.ParseUint(userIDStr, 10, 64); err == nil {
			userID := uint(id)
			filters.UserID = &userID
		}
	}

	// 基础筛选条件
	filters.Action = ctx.Query("action")
	filters.Resource = ctx.Query("resource")
	filters.IPAddress = ctx.Query("ip_address")
	filters.UserName = ctx.Query("user_name")

	// 解析时间范围
	if startTimeStr := ctx.Query("start_time"); startTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
			filters.StartTime = &t
		}
	}
	if endTimeStr := ctx.Query("end_time"); endTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, endTimeStr); err == nil {
			filters.EndTime = &t
		}
	}

	// 分页参数
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 使用增强的查询方法
	logs, total, err := ctrl.auditService.GetAuditLogsWithAdvancedFilters(filters, page, pageSize)
	if err != nil {
		response.InternalServerError(ctx, "获取应用审计日志失败")
		return
	}

	// 转换为DTO格式
	logDTOs := make([]AuditLogDTO, len(logs))
	for i, log := range logs {
		logDTOs[i] = ToAuditLogDTO(log)
	}

	// 构建响应
	resp := AuditLogListResponse{
		Logs:     logDTOs,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}

	response.Success(ctx, resp)
}

// GetOperationStatistics 获取应用操作统计
// @Summary 获取应用操作统计
// @Description 获取指定应用的操作统计数据，用于监控分析（仅支持应用级接口）
// @Tags 审计日志
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param days query int false "统计天数，范围1-365天" example(30)
// @Param limit query int false "返回统计条目数量限制" example(10)
// @Success 200 {object} response.APIResponse{data=object{statistics=[]OperationStat,period=object}} "操作统计数据和统计周期信息"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /api/v1/apps/{appId}/audit-logs/operation-statistics [get]
func (ctrl *AuditController) GetOperationStatistics(ctx *gin.Context) {
	currentUserID := ctx.GetUint("user_id")
	if currentUserID == 0 {
		response.Unauthorized(ctx, "用户信息获取失败")
		return
	}

	// 解析应用ID（路径参数）
	appIDParam := ctx.Param("appId")
	if appIDParam == "" {
		response.BadRequest(ctx, "缺少应用ID")
		return
	}
	appIDUint64, err := strconv.ParseUint(appIDParam, 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}
	appIDValue := uint(appIDUint64)

	// 验证应用权限
	userService := services.NewUserService()
	hasPermission, err := userService.CheckAppPermission(currentUserID, appIDValue, "viewer")
	if err != nil {
		response.InternalServerError(ctx, "权限检查失败")
		return
	}
	if !hasPermission {
		response.Forbidden(ctx, "无权限访问该应用的统计数据")
		return
	}

	// 解析统计天数
	days, _ := strconv.Atoi(ctx.DefaultQuery("days", "30"))
	if days < 1 || days > 365 {
		days = 30
	}

	// 获取操作统计
	appID := &appIDValue
	serviceStats, err := ctrl.auditService.GetOperationStatistics(appID, days)
	if err != nil {
		response.InternalServerError(ctx, "获取操作统计失败")
		return
	}

	// 转换为带有友好标签的统计数据
	stats := make([]OperationStat, len(serviceStats))
	for i, stat := range serviceStats {
		stats[i] = OperationStat{
			Action:        stat.Action,
			Resource:      stat.Resource,
			Count:         stat.Count,
			ActionLabel:   getActionLabel(stat.Action),
			ResourceLabel: getResourceLabel(stat.Resource),
		}
	}

	response.Success(ctx, gin.H{
		"statistics": stats,
		"period": gin.H{
			"days":     days,
			"app_id":   appIDValue,
			"app_name": nil, // 可以后续扩展获取应用名称
		},
	})
}

// GetUserActivityStatistics 获取应用用户活动统计
// @Summary 获取应用用户活动统计
// @Description 获取指定应用的用户活动统计数据（仅支持应用级接口）
// @Tags 审计日志
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param days query int false "统计天数，范围1-365天" example(30)
// @Param limit query int false "返回用户数量限制，范围1-50" example(10)
// @Success 200 {object} response.APIResponse{data=object{user_activity=[]services.UserActivityStat,period=object}} "用户活动统计数据和统计周期信息"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /api/v1/apps/{appId}/audit-logs/user-activity-statistics [get]
func (ctrl *AuditController) GetUserActivityStatistics(ctx *gin.Context) {
	currentUserID := ctx.GetUint("user_id")
	if currentUserID == 0 {
		response.Unauthorized(ctx, "用户信息获取失败")
		return
	}

	// 解析应用ID（路径参数）
	appIDParam := ctx.Param("appId")
	if appIDParam == "" {
		response.BadRequest(ctx, "缺少应用ID")
		return
	}
	appIDUint64, err := strconv.ParseUint(appIDParam, 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}
	appIDValue := uint(appIDUint64)

	// 验证应用权限
	userService := services.NewUserService()
	hasPermission, err := userService.CheckAppPermission(currentUserID, appIDValue, "viewer")
	if err != nil {
		response.InternalServerError(ctx, "权限检查失败")
		return
	}
	if !hasPermission {
		response.Forbidden(ctx, "无权限访问该应用的统计数据")
		return
	}

	// 解析参数
	days, _ := strconv.Atoi(ctx.DefaultQuery("days", "30"))
	if days < 1 || days > 365 {
		days = 30
	}

	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "10"))
	if limit < 1 || limit > 50 {
		limit = 10
	}

	// 获取用户活动统计
	appID := &appIDValue
	stats, err := ctrl.auditService.GetUserActivityStats(appID, days, limit)
	if err != nil {
		response.InternalServerError(ctx, "获取用户活动统计失败")
		return
	}

	response.Success(ctx, gin.H{
		"user_activity": stats,
		"period": gin.H{
			"days":   days,
			"limit":  limit,
			"app_id": appIDValue,
		},
	})
}
