package controllers

import (
	"strconv"

	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// TagController 设备标签控制器
type TagController struct {
	tagService *services.TagService
}

// NewTagController 创建标签控制器
func NewTagController() *TagController {
	return &TagController{
		tagService: services.NewTagService(),
	}
}

// AddDeviceTagRequest 添加设备标签请求
type AddDeviceTagRequest struct {
	TagName  string `json:"tag_name" binding:"required" example:"vip_level"`
	TagValue string `json:"tag_value" binding:"required" example:"gold"`
}

// AddDeviceTag 添加设备标签
// @Summary 添加设备标签
// @Description 为指定设备添加标签
// @Tags 设备标签
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param deviceToken path string true "设备Token"
// @Param tag body AddDeviceTagRequest true "标签信息"
// @Success 200 {object} response.APIResponse{data=models.DeviceTag} "标签添加成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/device-tags/{deviceToken} [post]
func (ctrl *TagController) AddDeviceTag(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	deviceToken := ctx.Param("deviceToken")
	if deviceToken == "" {
		response.BadRequest(ctx, "设备Token不能为空")
		return
	}

	var req AddDeviceTagRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	tag, err := ctrl.tagService.AddDeviceTag(uint(appID), deviceToken, req.TagName, req.TagValue)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, tag)
}

// GetDeviceTags 获取设备标签
// @Summary 获取设备标签
// @Description 获取指定设备的所有标签
// @Tags 设备标签
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param deviceToken path string true "设备Token"
// @Success 200 {object} response.APIResponse{data=[]models.DeviceTag} "设备标签列表"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/device-tags/{deviceToken} [get]
func (ctrl *TagController) GetDeviceTags(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	deviceToken := ctx.Param("deviceToken")
	if deviceToken == "" {
		response.BadRequest(ctx, "设备Token不能为空")
		return
	}

	tags, err := ctrl.tagService.GetDeviceTags(uint(appID), deviceToken)
	if err != nil {
		response.InternalServerError(ctx, "获取设备标签失败")
		return
	}

	response.Success(ctx, tags)
}

// DeleteDeviceTag 删除设备标签
// @Summary 删除设备标签
// @Description 删除指定设备的指定标签
// @Tags 设备标签
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param deviceToken path string true "设备Token"
// @Param tagName path string true "标签名称"
// @Success 200 {object} response.APIResponse "标签删除成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "标签不存在"
// @Router /apps/{appId}/device-tags/{deviceToken}/{tagName} [delete]
func (ctrl *TagController) DeleteDeviceTag(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	deviceToken := ctx.Param("deviceToken")
	tagName := ctx.Param("tagName")

	if deviceToken == "" || tagName == "" {
		response.BadRequest(ctx, "设备Token和标签名不能为空")
		return
	}

	err = ctrl.tagService.DeleteDeviceTag(uint(appID), deviceToken, tagName)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, gin.H{"message": "标签删除成功"})
}

// GetAppTagStatistics 获取应用标签统计
// @Summary 获取应用标签统计
// @Description 获取应用的设备标签使用统计，支持分页和搜索
// @Tags 设备标签
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param page query int false "页码，默认1"
// @Param limit query int false "每页数量，默认20，最大100"
// @Param search query string false "搜索关键词，支持标签名称和标签值"
// @Success 200 {object} response.APIResponse{data=services.TagStatisticsResponse} "标签统计数据"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/tags [get]
func (ctrl *TagController) GetAppTagStatistics(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	// 解析分页参数
	page := 1
	if pageStr := ctx.Query("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	limit := 20
	if limitStr := ctx.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	search := ctx.Query("search")

	result, err := ctrl.tagService.GetAppTagStatistics(uint(appID), page, limit, search)
	if err != nil {
		response.InternalServerError(ctx, "获取标签统计失败")
		return
	}

	response.Success(ctx, result)
}

// BatchAddDeviceTagsRequest 批量添加设备标签请求
type BatchAddDeviceTagsRequest struct {
	Tags []DeviceTagItem `json:"tags" binding:"required"`
}

type DeviceTagItem struct {
	DeviceToken string `json:"device_token" binding:"required"`
	TagName     string `json:"tag_name" binding:"required"`
	TagValue    string `json:"tag_value" binding:"required"`
}

// BatchAddDeviceTags 批量添加设备标签
// @Summary 批量添加设备标签
// @Description 为多个设备批量添加标签
// @Tags 设备标签
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param tags body BatchAddDeviceTagsRequest true "设备标签列表"
// @Success 200 {object} response.APIResponse "批量添加成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/device-tags/batch [post]
func (ctrl *TagController) BatchAddDeviceTags(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	var req BatchAddDeviceTagsRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	// 转换为模型对象
	var deviceTags []models.DeviceTag
	for _, item := range req.Tags {
		deviceTags = append(deviceTags, models.DeviceTag{
			AppID:       uint(appID),
			DeviceToken: item.DeviceToken,
			TagName:     item.TagName,
			TagValue:    item.TagValue,
		})
	}

	err = ctrl.tagService.BatchAddDeviceTags(uint(appID), deviceTags)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, gin.H{"message": "批量添加成功"})
}

// GetDevicesByTag 根据标签获取设备列表
// @Summary 根据标签获取设备列表
// @Description 根据标签名称和值获取设备Token列表
// @Tags 设备标签
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param tag_name query string true "标签名称"
// @Param tag_value query string false "标签值（可选）"
// @Success 200 {object} response.APIResponse{data=[]string} "设备Token列表"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/tags/devices [get]
func (ctrl *TagController) GetDevicesByTag(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	tagName := ctx.Query("tag_name")
	if tagName == "" {
		response.BadRequest(ctx, "标签名称不能为空")
		return
	}

	tagValue := ctx.Query("tag_value")

	deviceTokens, err := ctrl.tagService.GetDevicesByTag(uint(appID), tagName, tagValue)
	if err != nil {
		response.InternalServerError(ctx, "获取设备列表失败")
		return
	}

	response.Success(ctx, deviceTokens)
}
