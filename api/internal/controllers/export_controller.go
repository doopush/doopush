package controllers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// ExportController 导出控制器
type ExportController struct {
	exportService *services.ExportService
}

// NewExportController 创建导出控制器
func NewExportController() *ExportController {
	return &ExportController{
		exportService: services.NewExportService(),
	}
}

// ExportPushLogsRequest 导出推送日志请求
type ExportPushLogsRequest struct {
	Filters services.PushLogFilters `json:"filters"`
}

// ExportPushStatisticsRequest 导出推送统计请求
type ExportPushStatisticsRequest struct {
	TimeRange string `json:"time_range,omitempty"`
	StartDate string `json:"start_date,omitempty"`
	EndDate   string `json:"end_date,omitempty"`
}

// ExportPushLogs 导出推送日志
// @Summary 导出推送日志
// @Description 导出推送日志为Excel文件
// @Tags 导出
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param request body ExportPushLogsRequest true "导出请求"
// @Success 200 {object} response.APIResponse{data=services.ExportResult}
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 500 {object} response.APIResponse
// @Router /apps/{appId}/export/push-logs [post]
func (c *ExportController) ExportPushLogs(ctx *gin.Context) {
	// 获取应用ID
	appIDStr := ctx.Param("appId")
	appID, err := strconv.ParseUint(appIDStr, 10, 32)
	if err != nil {
		response.Error(ctx, http.StatusBadRequest, "无效的应用ID")
		return
	}

	// 获取用户ID
	userID, exists := ctx.Get("user_id")
	if !exists {
		response.Error(ctx, http.StatusUnauthorized, "用户未认证")
		return
	}

	// 解析请求参数
	var req ExportPushLogsRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.Error(ctx, http.StatusBadRequest, "请求参数错误: "+err.Error())
		return
	}

	// 解析时间参数
	if req.Filters.StartDate != nil {
		// 时间已经在结构体中处理
	}
	if req.Filters.EndDate != nil {
		// 时间已经在结构体中处理
	}

	// 调用服务导出
	result, err := c.exportService.ExportPushLogs(uint(appID), userID.(uint), req.Filters)
	if err != nil {
		response.Error(ctx, http.StatusInternalServerError, "导出失败: "+err.Error())
		return
	}

	response.Success(ctx, result)
}

// ExportPushStatistics 导出推送统计
// @Summary 导出推送统计
// @Description 导出推送统计为Excel文件
// @Tags 导出
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param request body ExportPushStatisticsRequest true "导出请求"
// @Success 200 {object} response.APIResponse{data=services.ExportResult}
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 500 {object} response.APIResponse
// @Router /apps/{appId}/export/push-statistics [post]
func (c *ExportController) ExportPushStatistics(ctx *gin.Context) {
	// 获取应用ID
	appIDStr := ctx.Param("appId")
	appID, err := strconv.ParseUint(appIDStr, 10, 32)
	if err != nil {
		response.Error(ctx, http.StatusBadRequest, "无效的应用ID")
		return
	}

	// 获取用户ID
	userID, exists := ctx.Get("user_id")
	if !exists {
		response.Error(ctx, http.StatusUnauthorized, "用户未认证")
		return
	}

	// 解析请求参数
	var req ExportPushStatisticsRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.Error(ctx, http.StatusBadRequest, "请求参数错误: "+err.Error())
		return
	}

	// 构建统计参数
	params := services.StatisticsParams{
		TimeRange: req.TimeRange,
	}

	// 解析时间参数
	if req.StartDate != "" {
		if startDate, err := time.Parse("2006-01-02", req.StartDate); err == nil {
			params.StartDate = &startDate
		} else {
			response.Error(ctx, http.StatusBadRequest, "开始日期格式错误，应为 YYYY-MM-DD")
			return
		}
	}

	if req.EndDate != "" {
		if endDate, err := time.Parse("2006-01-02", req.EndDate); err == nil {
			// 设置为当天结束时间
			endDate = endDate.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			params.EndDate = &endDate
		} else {
			response.Error(ctx, http.StatusBadRequest, "结束日期格式错误，应为 YYYY-MM-DD")
			return
		}
	}

	// 调用服务导出
	result, err := c.exportService.ExportPushStatistics(uint(appID), userID.(uint), params)
	if err != nil {
		response.Error(ctx, http.StatusInternalServerError, "导出失败: "+err.Error())
		return
	}

	response.Success(ctx, result)
}

// DownloadFile 下载文件
// @Summary 下载导出文件
// @Description 通过令牌下载导出的文件
// @Tags 导出
// @Produce application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
// @Param token path string true "下载令牌"
// @Success 200 {file} file "Excel文件"
// @Failure 400 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Failure 500 {object} response.APIResponse
// @Router /export/download/{token} [get]
func (c *ExportController) DownloadFile(ctx *gin.Context) {
	// 获取令牌
	token := ctx.Param("token")
	if token == "" {
		response.Error(ctx, http.StatusBadRequest, "缺少下载令牌")
		return
	}

	// 获取文件
	file, err := c.exportService.GetDownloadFile(token)
	if err != nil {
		if err.Error() == "下载链接无效或已过期" || err.Error() == "下载链接已过期" {
			response.Error(ctx, http.StatusNotFound, err.Error())
		} else {
			response.Error(ctx, http.StatusInternalServerError, "下载失败: "+err.Error())
		}
		return
	}

	// 设置响应头
	ctx.Header("Content-Type", file.ContentType)
	ctx.Header("Content-Disposition", "attachment; filename=\""+file.Filename+"\"")
	ctx.Header("Content-Length", strconv.Itoa(len(file.Data)))

	// 返回文件内容
	ctx.Data(http.StatusOK, file.ContentType, file.Data)
}
