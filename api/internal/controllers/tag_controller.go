package controllers

import (
	"strconv"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// TagController 用户标签控制器
type TagController struct {
	tagService *services.TagService
}

// NewTagController 创建标签控制器
func NewTagController() *TagController {
	return &TagController{
		tagService: services.NewTagService(),
	}
}

// AddUserTagRequest 添加用户标签请求
type AddUserTagRequest struct {
	TagName  string `json:"tag_name" binding:"required" example:"vip_level"`
	TagValue string `json:"tag_value" binding:"required" example:"gold"`
}

// AddUserTag 添加用户标签
// @Summary 添加用户标签
// @Description 为指定用户添加标签
// @Tags 用户标签
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param userId path string true "用户ID"
// @Param tag body AddUserTagRequest true "标签信息"
// @Success 200 {object} response.APIResponse{data=models.UserTag} "标签添加成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/users/{userId}/tags [post]
func (ctrl *TagController) AddUserTag(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	userID := ctx.Param("userId")
	if userID == "" {
		response.BadRequest(ctx, "用户ID不能为空")
		return
	}

	var req AddUserTagRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	tag, err := ctrl.tagService.AddUserTag(uint(appID), userID, req.TagName, req.TagValue)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, tag)
}

// GetUserTags 获取用户标签
// @Summary 获取用户标签
// @Description 获取指定用户的所有标签
// @Tags 用户标签
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param userId path string true "用户ID"
// @Success 200 {object} response.APIResponse{data=[]models.UserTag} "用户标签列表"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/users/{userId}/tags [get]
func (ctrl *TagController) GetUserTags(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	userID := ctx.Param("userId")
	if userID == "" {
		response.BadRequest(ctx, "用户ID不能为空")
		return
	}

	tags, err := ctrl.tagService.GetUserTags(uint(appID), userID)
	if err != nil {
		response.InternalServerError(ctx, "获取用户标签失败")
		return
	}

	response.Success(ctx, tags)
}

// DeleteUserTag 删除用户标签
// @Summary 删除用户标签
// @Description 删除指定用户的指定标签
// @Tags 用户标签
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param userId path string true "用户ID"
// @Param tagName path string true "标签名称"
// @Success 200 {object} response.APIResponse "标签删除成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "标签不存在"
// @Router /apps/{appId}/users/{userId}/tags/{tagName} [delete]
func (ctrl *TagController) DeleteUserTag(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	userID := ctx.Param("userId")
	tagName := ctx.Param("tagName")

	if userID == "" || tagName == "" {
		response.BadRequest(ctx, "用户ID和标签名不能为空")
		return
	}

	err = ctrl.tagService.DeleteUserTag(uint(appID), userID, tagName)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, gin.H{"message": "标签删除成功"})
}

// GetAppTagStatistics 获取应用标签统计
// @Summary 获取应用标签统计
// @Description 获取应用的所有标签使用统计
// @Tags 用户标签
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Success 200 {object} response.APIResponse{data=[]services.TagStatistic} "标签统计数据"
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

	stats, err := ctrl.tagService.GetAppTagStatistics(uint(appID))
	if err != nil {
		response.InternalServerError(ctx, "获取标签统计失败")
		return
	}

	response.Success(ctx, stats)
}
