package controllers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// PushController 推送控制器
type PushController struct {
	pushService *services.PushService
}

// NewPushController 创建推送控制器
func NewPushController() *PushController {
	return &PushController{
		pushService: services.NewPushService(),
	}
}

// PushPayload 推送负载数据
type PushPayload struct {
	Action string `json:"action,omitempty" example:"open_page"`        // 动作类型
	URL    string `json:"url,omitempty" example:"https://example.com"` // 链接地址
	Data   string `json:"data,omitempty" example:"extra_data"`         // 额外数据，JSON字符串
}

// SendPushRequest 发送推送请求
type SendPushRequest struct {
	Title    string              `json:"title" binding:"required,max=200" example:"新消息"`
	Content  string              `json:"content" binding:"required" example:"您有一条新消息"`
	Payload  PushPayload         `json:"payload,omitempty"`
	Target   services.PushTarget `json:"target" binding:"required"`
	Schedule *string             `json:"schedule_time,omitempty" example:"2024-12-31T10:00:00Z"`
}

// PushLogsResponse 推送日志列表响应
type PushLogsResponse struct {
	Logs     []interface{} `json:"logs"`
	Total    int64         `json:"total" example:"100"`
	Page     int           `json:"page" example:"1"`
	PageSize int           `json:"page_size" example:"20"`
}

// SendPush 发送推送
// @Summary 发送推送
// @Description 向指定目标发送推送通知
// @Tags 推送管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param request body SendPushRequest true "推送信息"
// @Success 200 {object} response.APIResponse{data=[]models.PushLog}
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Failure 422 {object} response.APIResponse
// @Router /apps/{appId}/push [post]
func (p *PushController) SendPush(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	var req SendPushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	// 将 PushPayload 转换为 map[string]interface{}
	payload := make(map[string]interface{})
	if req.Payload.Action != "" {
		payload["action"] = req.Payload.Action
	}
	if req.Payload.URL != "" {
		payload["url"] = req.Payload.URL
	}
	if req.Payload.Data != "" {
		payload["data"] = req.Payload.Data
	}

	// 构建推送请求
	pushReq := services.PushRequest{
		Title:   req.Title,
		Content: req.Content,
		Payload: payload,
		Target:  req.Target,
	}

	// 处理定时推送
	if req.Schedule != nil && *req.Schedule != "" {
		if scheduleTime, err := time.Parse(time.RFC3339, *req.Schedule); err == nil {
			pushReq.Schedule = &scheduleTime
		} else {
			response.BadRequest(c, "定时时间格式错误，请使用RFC3339格式")
			return
		}
	}

	userID := c.GetUint("user_id")
	pushLogs, err := p.pushService.SendPush(uint(appID), userID, pushReq)
	if err != nil {
		if err.Error() == "无权限发送推送" {
			response.Forbidden(c, err.Error())
		} else {
			response.Error(c, http.StatusUnprocessableEntity, err.Error())
		}
		return
	}

	message := "推送发送成功"
	if req.Schedule != nil {
		message = "推送已加入定时队列"
	}

	response.Success(c, gin.H{
		"message":   message,
		"push_logs": pushLogs,
		"count":     len(pushLogs),
	})
}

// GetPushLogs 获取推送日志
// @Summary 获取推送日志
// @Description 获取应用的推送日志列表
// @Tags 推送管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页数量" default(20)
// @Param status query string false "推送状态筛选" Enums(pending, sent, failed)
// @Param platform query string false "设备平台筛选" Enums(ios, android)
// @Success 200 {object} response.APIResponse{data=PushLogsResponse}
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Router /apps/{appId}/push/logs [get]
func (p *PushController) GetPushLogs(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	// 获取查询参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")
	platform := c.Query("platform")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	userID := c.GetUint("user_id")
	pushLogs, total, err := p.pushService.GetPushLogsWithFilters(uint(appID), userID, page, pageSize, status, platform)
	if err != nil {
		if err.Error() == "无权限访问该应用" {
			response.Forbidden(c, err.Error())
		} else {
			response.InternalServerError(c, err.Error())
		}
		return
	}

	response.Success(c, PushLogsResponse{
		Logs: func() []interface{} {
			result := make([]interface{}, len(pushLogs))
			for i, log := range pushLogs {
				// 为每个日志添加统计信息
				enrichedLog := gin.H{
					"id":         log.ID,
					"app_id":     log.AppID,
					"device_id":  log.DeviceID,
					"title":      log.Title,
					"content":    log.Content,
					"payload":    log.Payload,
					"channel":    log.Channel,
					"status":     log.Status,
					"dedup_key":  log.DedupKey,
					"send_at":    log.SendAt,
					"created_at": log.CreatedAt,
					"updated_at": log.UpdatedAt,
				}

				// 计算统计信息（基于关联的推送结果）
				var totalDevices, successCount, failedCount, pendingCount int64

				// 如果这是一个单设备推送，统计数据较简单
				if log.PushResult != nil {
					totalDevices = 1
					if log.PushResult.Success {
						successCount = 1
					} else {
						failedCount = 1
					}
				} else {
					// 对于批量推送，需要查询所有相关的推送结果
					database.DB.Model(&models.PushResult{}).Where("push_log_id = ?", log.ID).Count(&totalDevices)
					database.DB.Model(&models.PushResult{}).Where("push_log_id = ? AND success = ?", log.ID, true).Count(&successCount)
					database.DB.Model(&models.PushResult{}).Where("push_log_id = ? AND success = ?", log.ID, false).Count(&failedCount)
					pendingCount = totalDevices - successCount - failedCount
				}

				// 添加统计字段
				enrichedLog["total_devices"] = totalDevices
				enrichedLog["success_count"] = successCount
				enrichedLog["failed_count"] = failedCount
				enrichedLog["pending_count"] = pendingCount

				// 添加目标相关字段（从现有数据推导）
				enrichedLog["target_type"] = "devices"
				enrichedLog["target_value"] = ""
				enrichedLog["platform_stats"] = ""

				result[i] = enrichedLog
			}
			return result
		}(),
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// GetPushStatistics 获取推送统计
// @Summary 获取推送统计
// @Description 获取应用的推送统计数据
// @Tags 推送管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param date query string false "统计日期" example:"2024-01-01"
// @Success 200 {object} response.APIResponse{data=map[string]interface{}}
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Router /apps/{appId}/push/statistics [get]
func (p *PushController) GetPushStatistics(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	// 检查用户权限
	userID := c.GetUint("user_id")
	userService := services.NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, uint(appID), "viewer")
	if err != nil {
		response.InternalServerError(c, "权限检查失败")
		return
	}
	if !hasPermission {
		response.Forbidden(c, "无权限访问该应用")
		return
	}

	// 获取统计数据 (简化版本)
	var stats struct {
		TotalPushes   int64 `json:"total_pushes"`
		SuccessPushes int64 `json:"success_pushes"`
		FailedPushes  int64 `json:"failed_pushes"`
		TotalDevices  int64 `json:"total_devices"`
	}

	// 统计推送总数
	database.DB.Model(&models.PushLog{}).Where("app_id = ?", appID).Count(&stats.TotalPushes)

	// 统计成功推送
	database.DB.Model(&models.PushLog{}).Where("app_id = ? AND status = 'sent'", appID).Count(&stats.SuccessPushes)

	// 统计失败推送
	database.DB.Model(&models.PushLog{}).Where("app_id = ? AND status = 'failed'", appID).Count(&stats.FailedPushes)

	// 统计设备总数
	database.DB.Model(&models.Device{}).Where("app_id = ? AND status = 1", appID).Count(&stats.TotalDevices)

	response.Success(c, stats)
}

// GetPushLogDetails 获取推送日志详情
// @Summary 获取推送日志详情
// @Description 获取指定推送日志的详细信息和推送结果
// @Tags 推送管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param logId path int true "推送日志ID"
// @Success 200 {object} response.APIResponse{data=object}
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "日志不存在"
// @Router /apps/{appId}/push/logs/{logId} [get]
func (p *PushController) GetPushLogDetails(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	logID, err := strconv.ParseUint(c.Param("logId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的日志ID")
		return
	}

	// 检查用户权限
	userID := c.GetUint("user_id")
	userService := services.NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, uint(appID), "viewer")
	if err != nil {
		response.InternalServerError(c, "权限检查失败")
		return
	}
	if !hasPermission {
		response.Forbidden(c, "无权限访问该应用")
		return
	}

	// 获取推送日志
	var pushLog models.PushLog
	if err := database.DB.Where("id = ? AND app_id = ?", logID, appID).
		Preload("Device").
		Preload("PushResult").
		First(&pushLog).Error; err != nil {
		response.NotFound(c, "推送日志不存在")
		return
	}

	// 获取该推送任务的所有结果（如果是批量推送）
	var allResults []models.PushResult
	database.DB.Where("push_log_id = ?", logID).Find(&allResults)

	// 构建详细信息
	details := gin.H{
		"log":     pushLog,
		"results": allResults,
		"stats": gin.H{
			"total_devices": len(allResults),
			"success_count": len(func() []models.PushResult {
				var s []models.PushResult
				for _, r := range allResults {
					if r.Success {
						s = append(s, r)
					}
				}
				return s
			}()),
			"failed_count": len(func() []models.PushResult {
				var f []models.PushResult
				for _, r := range allResults {
					if !r.Success {
						f = append(f, r)
					}
				}
				return f
			}()),
		},
	}

	response.Success(c, details)
}

// SendSingleRequest 单设备推送请求
type SendSingleRequest struct {
	DeviceID string      `json:"device_id" binding:"required" example:"device123"`
	Title    string      `json:"title" binding:"required,max=200" example:"个人消息"`
	Content  string      `json:"content" binding:"required" example:"您有一条个人消息"`
	Payload  PushPayload `json:"payload,omitempty"`
}

// SendBatchRequest 批量推送请求
type SendBatchRequest struct {
	DeviceIDs []string    `json:"device_ids" binding:"required,min=1,max=1000" example:"[\"device1\",\"device2\"]"`
	Title     string      `json:"title" binding:"required,max=200" example:"批量消息"`
	Content   string      `json:"content" binding:"required" example:"批量推送消息内容"`
	Payload   PushPayload `json:"payload,omitempty"`
}

// SendBroadcastRequest 广播推送请求
type SendBroadcastRequest struct {
	Title    string      `json:"title" binding:"required,max=200" example:"系统公告"`
	Content  string      `json:"content" binding:"required" example:"系统维护通知"`
	Payload  PushPayload `json:"payload,omitempty"`
	Platform string      `json:"platform,omitempty" example:"ios"`  // 可选：指定平台
	Vendor   string      `json:"vendor,omitempty" example:"huawei"` // 可选：指定厂商
}

// SendSingle 单设备推送
// @Summary 单设备推送
// @Description 向指定设备发送推送通知
// @Tags 推送管理
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param push body SendSingleRequest true "单推请求"
// @Success 200 {object} response.APIResponse{data=object} "推送发送成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/push/single [post]
func (ctrl *PushController) SendSingle(ctx *gin.Context) {
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

	var req SendSingleRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	// 将 PushPayload 转换为 map[string]interface{}
	payload := make(map[string]interface{})
	if req.Payload.Action != "" {
		payload["action"] = req.Payload.Action
	}
	if req.Payload.URL != "" {
		payload["url"] = req.Payload.URL
	}
	if req.Payload.Data != "" {
		payload["data"] = req.Payload.Data
	}

	// 通过device_id字符串查询实际的设备主键ID
	var device models.Device
	if err := database.DB.Where("token = ? AND app_id = ? AND status = 1", req.DeviceID, appID).First(&device).Error; err != nil {
		response.BadRequest(ctx, "找不到指定的设备或设备已失效")
		return
	}

	pushReq := services.PushRequest{
		Title:   req.Title,
		Content: req.Content,
		Payload: payload,
		Target: services.PushTarget{
			Type:      "devices",
			DeviceIDs: []uint{device.ID},
		},
	}

	// 执行推送
	result, err := ctrl.pushService.SendPush(uint(appID), userID, pushReq)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, result)
}

// SendBatch 批量推送
// @Summary 批量推送
// @Description 向多个指定设备发送推送通知
// @Tags 推送管理
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param push body SendBatchRequest true "批量推送请求"
// @Success 200 {object} response.APIResponse{data=object} "推送发送成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/push/batch [post]
func (ctrl *PushController) SendBatch(ctx *gin.Context) {
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

	var req SendBatchRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	// 将 PushPayload 转换为 map[string]interface{}
	payload := make(map[string]interface{})
	if req.Payload.Action != "" {
		payload["action"] = req.Payload.Action
	}
	if req.Payload.URL != "" {
		payload["url"] = req.Payload.URL
	}
	if req.Payload.Data != "" {
		payload["data"] = req.Payload.Data
	}

	// 通过device_id字符串批量查询实际的设备主键ID
	var devices []models.Device
	if err := database.DB.Where("token IN ? AND app_id = ? AND status = 1", req.DeviceIDs, appID).Find(&devices).Error; err != nil {
		response.BadRequest(ctx, "查询设备失败")
		return
	}

	if len(devices) == 0 {
		response.BadRequest(ctx, "没有找到有效的设备")
		return
	}

	// 提取设备ID
	var deviceIDs []uint
	for _, device := range devices {
		deviceIDs = append(deviceIDs, device.ID)
	}

	pushReq := services.PushRequest{
		Title:   req.Title,
		Content: req.Content,
		Payload: payload,
		Target: services.PushTarget{
			Type:      "devices",
			DeviceIDs: deviceIDs,
		},
	}

	// 执行推送
	result, err := ctrl.pushService.SendPush(uint(appID), userID, pushReq)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, result)
}

// SendBroadcast 广播推送
// @Summary 广播推送
// @Description 向应用的所有设备发送推送通知
// @Tags 推送管理
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param push body SendBroadcastRequest true "广播推送请求"
// @Success 200 {object} response.APIResponse{data=object} "推送发送成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/push/broadcast [post]
func (ctrl *PushController) SendBroadcast(ctx *gin.Context) {
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

	var req SendBroadcastRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	// 将 PushPayload 转换为 map[string]interface{}
	payload := make(map[string]interface{})
	if req.Payload.Action != "" {
		payload["action"] = req.Payload.Action
	}
	if req.Payload.URL != "" {
		payload["url"] = req.Payload.URL
	}
	if req.Payload.Data != "" {
		payload["data"] = req.Payload.Data
	}

	// 构建推送目标
	pushReq := services.PushRequest{
		Title:   req.Title,
		Content: req.Content,
		Payload: payload,
		Target: services.PushTarget{
			Type:     "all",
			Platform: req.Platform,
		},
	}

	// 执行推送
	result, err := ctrl.pushService.SendPush(uint(appID), userID, pushReq)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, result)
}
