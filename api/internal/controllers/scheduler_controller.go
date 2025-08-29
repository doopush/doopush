package controllers

import (
	"strconv"
	"time"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/doopush/doopush/api/pkg/utils"
	"github.com/gin-gonic/gin"
)

// SchedulerController 定时推送控制器
type SchedulerController struct {
	schedulerService *services.SchedulerService
}

// NewSchedulerController 创建定时推送控制器
func NewSchedulerController() *SchedulerController {
	return &SchedulerController{
		schedulerService: services.NewSchedulerService(),
	}
}

// CreateScheduledPushRequest 创建定时推送请求
type CreateScheduledPushRequest struct {
	// 兼容前端字段
	Title        string `json:"title" binding:"required" example:"推送标题"`
	Content      string `json:"content" binding:"required" example:"推送内容"`
	Payload      string `json:"payload" example:"{}"`
	Badge        *int   `json:"badge,omitempty" example:"1"`
	ScheduledAt  string `json:"scheduled_at" binding:"required" example:"2024-01-01T10:00:00Z"`
	PushType     string `json:"push_type" binding:"required" example:"single"`
	TargetConfig string `json:"target_config" example:"device_token_or_config"`
	RepeatType   string `json:"repeat_type" binding:"required,oneof=none once daily weekly monthly" example:"none"`
	RepeatConfig string `json:"repeat_config" example:""`
	Timezone     string `json:"timezone" example:"Asia/Shanghai"`

	// 后端内部字段（可选，向后兼容）
	Name         string `json:"name" example:"每日活动推送"`
	TemplateID   *uint  `json:"template_id" example:"1"`
	TargetType   string `json:"target_type" example:"all"`
	TargetValue  string `json:"target_value" example:"vip_users"`
	ScheduleTime string `json:"schedule_time" example:"2024-01-01T10:00:00Z"`
	CronExpr     string `json:"cron_expr" example:"0 10 * * *"`
}

// UpdateScheduledPushRequest 更新定时推送请求
type UpdateScheduledPushRequest struct {
	// 前端字段（保持与创建请求一致）
	Title        string `json:"title" binding:"required" example:"推送标题"`
	Content      string `json:"content" binding:"required" example:"推送内容"`
	Payload      string `json:"payload" example:"{}"`
	Badge        *int   `json:"badge,omitempty" example:"1"`
	ScheduledAt  string `json:"scheduled_at" binding:"required" example:"2024-01-01T10:00:00Z"`
	PushType     string `json:"push_type" binding:"required" example:"single"`
	TargetConfig string `json:"target_config" example:"device_token_or_config"`
	RepeatType   string `json:"repeat_type" binding:"required,oneof=none once daily weekly monthly" example:"none"`
	RepeatConfig string `json:"repeat_config" example:""`
	Timezone     string `json:"timezone" example:"Asia/Shanghai"`
	Status       string `json:"status" binding:"oneof=pending paused completed failed" example:"pending"`

	// 后端内部字段（可选，向后兼容）
	Name         string `json:"name" example:"每日活动推送"`
	TemplateID   *uint  `json:"template_id" example:"1"`
	TargetType   string `json:"target_type" example:"all"`
	TargetValue  string `json:"target_value" example:"vip_users"`
	ScheduleTime string `json:"schedule_time" example:"2024-01-01T10:00:00Z"`
	CronExpr     string `json:"cron_expr" example:"0 10 * * *"`
}

// CreateScheduledPush 创建定时推送
// @Summary 创建定时推送
// @Description 创建一个新的定时推送任务
// @Tags 定时推送
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param push body CreateScheduledPushRequest true "定时推送信息"
// @Success 200 {object} response.APIResponse{data=models.ScheduledPush} "定时推送创建成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/scheduled-pushes [post]
func (ctrl *SchedulerController) CreateScheduledPush(ctx *gin.Context) {
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

	var req CreateScheduledPushRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	// 字段映射和转换
	name := req.Name
	if name == "" {
		name = req.Title // 使用title作为name
	}

	scheduleTimeStr := req.ScheduleTime
	if scheduleTimeStr == "" {
		scheduleTimeStr = req.ScheduledAt // 使用前端字段
	}

	targetType := req.TargetType
	targetValue := req.TargetValue
	repeatType := req.RepeatType

	// 前端字段转换
	if targetType == "" {
		switch req.PushType {
		case "single":
			targetType = "devices"
			targetValue = req.TargetConfig
		case "batch":
			targetType = "devices"
			targetValue = req.TargetConfig
		case "broadcast":
			targetType = "all"
			targetValue = req.TargetConfig
		case "all":
			targetType = "all"
			targetValue = ""
		case "groups":
			targetType = "groups"
			targetValue = req.TargetConfig
		case "tag":
			targetType = "tags"
			targetValue = req.TargetConfig
		default:
			targetType = "all"
			targetValue = ""
		}
	}

	// 确保 targetValue 有值
	if targetValue == "" && req.TargetConfig != "" {
		targetValue = req.TargetConfig
	}

	// repeat_type转换：前端"none" -> 后端"once"
	if repeatType == "none" {
		repeatType = "once"
	}

	// 解析调度时间
	scheduleTime, err := time.Parse(time.RFC3339, scheduleTimeStr)
	if err != nil {
		response.BadRequest(ctx, "调度时间格式错误")
		return
	}

	// 验证调度时间必须是未来时间
	if scheduleTime.Before(time.Now()) || scheduleTime.Equal(time.Now()) {
		response.BadRequest(ctx, "调度时间必须是未来时间")
		return
	}

	timezone := req.Timezone
	if timezone == "" {
		timezone = "UTC"
	}

	// 处理 payload，确保为有效的 JSON 格式
	payload := req.Payload
	if payload == "" {
		payload = "{}" // 空字符串时设置为空 JSON 对象
	}
	// 验证 payload 是否为有效的 JSON 格式
	if !utils.StringIsValidJSON(payload) {
		response.BadRequest(ctx, "附加数据必须是有效的JSON格式")
		return
	}

	// 创建定时推送任务，包含推送内容
	push, err := ctrl.schedulerService.CreateScheduledPushWithContent(
		uint(appID), userID, name, req.Title, req.Content, payload, req.PushType,
		targetType, targetValue, scheduleTime, timezone, repeatType, req.RepeatConfig, req.CronExpr, req.Badge,
	)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, push)
}

// GetScheduledPushes 获取定时推送列表
// @Summary 获取定时推送列表
// @Description 获取指定应用的定时推送任务列表
// @Tags 定时推送
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param search query string false "搜索关键词（标题或内容）"
// @Param status query string false "状态筛选" Enums(pending, running, paused, completed, failed)
// @Param repeat_type query string false "重复类型筛选" Enums(once, daily, weekly, monthly)
// @Param page query int false "页码" example(1)
// @Param page_size query int false "每页数量" example(20)
// @Success 200 {object} response.APIResponse{data=[]models.ScheduledPush, pagination=object} "定时推送列表"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/scheduled-pushes [get]
func (ctrl *SchedulerController) GetScheduledPushes(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	// 获取查询参数
	search := ctx.Query("search")
	status := ctx.Query("status")
	repeatType := ctx.Query("repeat_type")
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	pushes, total, err := ctrl.schedulerService.GetScheduledPushesWithFilters(uint(appID), search, status, repeatType, page, pageSize)
	if err != nil {
		response.InternalServerError(ctx, "获取定时推送列表失败")
		return
	}

	response.Success(ctx, gin.H{
		"data": pushes,
		"pagination": gin.H{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

// GetScheduledPushStats 获取定时推送统计数据
// @Summary 获取定时推送统计数据
// @Description 获取指定应用的定时推送任务统计数据
// @Tags 定时推送
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Success 200 {object} response.APIResponse{data=map[string]int64} "统计数据"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/scheduled-pushes/stats [get]
func (ctrl *SchedulerController) GetScheduledPushStats(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	stats, err := ctrl.schedulerService.GetScheduledPushStats(uint(appID))
	if err != nil {
		response.InternalServerError(ctx, "获取统计数据失败")
		return
	}

	response.Success(ctx, stats)
}

// GetScheduledPush 获取定时推送详情
// @Summary 获取定时推送详情
// @Description 获取指定定时推送任务的详细信息
// @Tags 定时推送
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "任务ID"
// @Success 200 {object} response.APIResponse{data=models.ScheduledPush} "定时推送详情"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "任务不存在"
// @Router /apps/{appId}/scheduled-pushes/{id} [get]
func (ctrl *SchedulerController) GetScheduledPush(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	pushID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的任务ID")
		return
	}

	push, err := ctrl.schedulerService.GetScheduledPush(uint(appID), uint(pushID))
	if err != nil {
		response.NotFound(ctx, err.Error())
		return
	}

	response.Success(ctx, push)
}

// UpdateScheduledPush 更新定时推送
// @Summary 更新定时推送
// @Description 更新指定定时推送任务的信息
// @Tags 定时推送
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "任务ID"
// @Param push body UpdateScheduledPushRequest true "定时推送信息"
// @Success 200 {object} response.APIResponse{data=models.ScheduledPush} "任务更新成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "任务不存在"
// @Router /apps/{appId}/scheduled-pushes/{id} [put]
func (ctrl *SchedulerController) UpdateScheduledPush(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	pushID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的任务ID")
		return
	}

	var req UpdateScheduledPushRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	// 字段映射和转换（与创建逻辑保持一致）
	name := req.Name
	if name == "" {
		name = req.Title // 使用title作为name
	}

	scheduleTimeStr := req.ScheduleTime
	if scheduleTimeStr == "" {
		scheduleTimeStr = req.ScheduledAt // 使用前端字段
	}

	targetType := req.TargetType
	targetValue := req.TargetValue
	repeatType := req.RepeatType

	// 前端字段转换
	if targetType == "" {
		switch req.PushType {
		case "single":
			targetType = "devices"
			targetValue = req.TargetConfig
		case "batch":
			targetType = "devices"
			targetValue = req.TargetConfig
		case "broadcast":
			targetType = "all"
			targetValue = req.TargetConfig
		case "all":
			targetType = "all"
			targetValue = ""
		case "groups":
			targetType = "groups"
			targetValue = req.TargetConfig
		case "tag":
			targetType = "tags"
			targetValue = req.TargetConfig
		default:
			targetType = "all"
			targetValue = ""
		}
	}

	// 确保 targetValue 有值
	if targetValue == "" && req.TargetConfig != "" {
		targetValue = req.TargetConfig
	}

	// repeat_type转换：前端"none" -> 后端"once"
	if repeatType == "none" {
		repeatType = "once"
	}

	// 解析调度时间
	scheduleTime, err := time.Parse(time.RFC3339, scheduleTimeStr)
	if err != nil {
		response.BadRequest(ctx, "调度时间格式错误")
		return
	}

	// 验证调度时间必须是未来时间
	if scheduleTime.Before(time.Now()) || scheduleTime.Equal(time.Now()) {
		response.BadRequest(ctx, "调度时间必须是未来时间")
		return
	}

	timezone := req.Timezone
	if timezone == "" {
		timezone = "UTC"
	}

	// 处理 payload，确保为有效的 JSON 格式
	payload := req.Payload
	if payload == "" {
		payload = "{}" // 空字符串时设置为空 JSON 对象
	}
	// 验证 payload 是否为有效的 JSON 格式
	if !utils.StringIsValidJSON(payload) {
		response.BadRequest(ctx, "附加数据必须是有效的JSON格式")
		return
	}

	push, err := ctrl.schedulerService.UpdateScheduledPushWithContent(
		uint(appID), uint(pushID), name, req.Title, req.Content, payload, req.PushType,
		targetType, targetValue, scheduleTime, timezone, repeatType, req.RepeatConfig, req.CronExpr, req.Status, req.Badge,
	)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, push)
}

// DeleteScheduledPush 删除定时推送
// @Summary 删除定时推送
// @Description 删除指定的定时推送任务
// @Tags 定时推送
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "任务ID"
// @Success 200 {object} response.APIResponse "任务删除成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "任务不存在"
// @Router /apps/{appId}/scheduled-pushes/{id} [delete]
func (ctrl *SchedulerController) DeleteScheduledPush(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	pushID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的任务ID")
		return
	}

	err = ctrl.schedulerService.DeleteScheduledPush(uint(appID), uint(pushID))
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, gin.H{"message": "任务删除成功"})
}

// PauseScheduledPush 暂停定时推送
// @Summary 暂停定时推送
// @Description 暂停指定的定时推送任务
// @Tags 定时推送
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "任务ID"
// @Success 200 {object} response.APIResponse "任务暂停成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "任务不存在"
// @Router /apps/{appId}/scheduled-pushes/{id}/pause [post]
func (ctrl *SchedulerController) PauseScheduledPush(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	pushID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的任务ID")
		return
	}

	err = ctrl.schedulerService.PauseScheduledPush(uint(appID), uint(pushID))
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, gin.H{"message": "任务暂停成功"})
}

// ResumeScheduledPush 恢复定时推送
// @Summary 恢复定时推送
// @Description 恢复指定的定时推送任务
// @Tags 定时推送
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "任务ID"
// @Success 200 {object} response.APIResponse "任务恢复成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "任务不存在"
// @Router /apps/{appId}/scheduled-pushes/{id}/resume [post]
func (ctrl *SchedulerController) ResumeScheduledPush(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	pushID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的任务ID")
		return
	}

	err = ctrl.schedulerService.ResumeScheduledPush(uint(appID), uint(pushID))
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, gin.H{"message": "任务恢复成功"})
}

// ExecuteScheduledPush 立即执行定时推送
// @Summary 立即执行定时推送
// @Description 立即执行指定的定时推送任务
// @Tags 定时推送
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "任务ID"
// @Success 200 {object} response.APIResponse "任务执行成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "任务不存在"
// @Router /apps/{appId}/scheduled-pushes/{id}/execute [post]
func (ctrl *SchedulerController) ExecuteScheduledPush(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	pushID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的任务ID")
		return
	}

	// 执行定时推送任务（包含应用权限验证）
	err = ctrl.schedulerService.ExecuteScheduledPush(uint(appID), uint(pushID))
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, gin.H{
		"message": "任务执行成功",
	})
}
