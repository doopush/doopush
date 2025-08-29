package controllers

import (
	"strconv"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/doopush/doopush/api/pkg/utils"
	"github.com/gin-gonic/gin"
)

// GroupController 设备分组控制器
type GroupController struct {
	groupService *services.GroupService
}

// NewGroupController 创建分组控制器
func NewGroupController() *GroupController {
	return &GroupController{
		groupService: services.NewGroupService(),
	}
}

// CreateGroupRequest 创建分组请求
type CreateGroupRequest struct {
	Name        string                `json:"name" binding:"required" example:"iOS用户"`
	Description string                `json:"description" example:"所有iOS平台用户"`
	FilterRules []services.FilterRule `json:"filter_rules" binding:"required"`
}

// UpdateGroupRequest 更新分组请求
type UpdateGroupRequest struct {
	Name        string                `json:"name" binding:"required"`
	Description string                `json:"description"`
	FilterRules []services.FilterRule `json:"filter_rules" binding:"required"`
	IsActive    bool                  `json:"is_active"`
}

// CreateGroup 创建设备分组
// @Summary 创建设备分组
// @Description 创建一个新的设备分组，支持根据筛选规则自动匹配设备
// @Tags 设备分组
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param group body CreateGroupRequest true "分组信息"
// @Success 200 {object} response.APIResponse{data=models.DeviceGroup} "分组创建成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/device-groups [post]
func (ctrl *GroupController) CreateGroup(ctx *gin.Context) {
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

	var req CreateGroupRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	group, err := ctrl.groupService.CreateGroup(uint(appID), userID, req.Name, req.Description, req.FilterRules)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, group)
}

// GetGroups 获取分组列表
// @Summary 获取分组列表
// @Description 获取指定应用的设备分组列表
// @Tags 设备分组
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param page query int false "页码" example(1)
// @Param page_size query int false "每页数量" example(20)
// @Success 200 {object} response.APIResponse{data=[]models.DeviceGroup} "分组列表"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Router /apps/{appId}/device-groups [get]
func (ctrl *GroupController) GetGroups(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	groups, total, err := ctrl.groupService.GetGroups(uint(appID), page, pageSize)
	if err != nil {
		response.InternalServerError(ctx, "获取分组列表失败")
		return
	}

	response.Success(ctx, utils.NewPaginationResponse(page, pageSize, total, gin.H{
		"items": groups,
	}))
}

// GetGroup 获取分组详情
// @Summary 获取分组详情
// @Description 获取指定分组的详细信息和设备列表
// @Tags 设备分组
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "分组ID"
// @Param page query int false "页码" example(1)
// @Param page_size query int false "每页数量" example(20)
// @Success 200 {object} response.APIResponse{data=object} "分组详情和设备列表"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "分组不存在"
// @Router /apps/{appId}/device-groups/{id} [get]
func (ctrl *GroupController) GetGroup(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	groupID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的分组ID")
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 获取分组信息
	group, err := ctrl.groupService.GetGroup(uint(appID), uint(groupID))
	if err != nil {
		response.NotFound(ctx, err.Error())
		return
	}

	// 获取分组设备列表
	devices, total, err := ctrl.groupService.GetGroupDevices(uint(appID), uint(groupID), page, pageSize)
	if err != nil {
		response.InternalServerError(ctx, "获取分组设备失败")
		return
	}

	response.Success(ctx, utils.NewPaginationResponse(page, pageSize, total, gin.H{
		"group": group,
		"items": devices,
	}))
}

// UpdateGroup 更新分组
// @Summary 更新设备分组
// @Description 更新指定分组的信息和筛选规则
// @Tags 设备分组
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "分组ID"
// @Param group body UpdateGroupRequest true "分组信息"
// @Success 200 {object} response.APIResponse{data=models.DeviceGroup} "分组更新成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "分组不存在"
// @Router /apps/{appId}/device-groups/{id} [put]
func (ctrl *GroupController) UpdateGroup(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	groupID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的分组ID")
		return
	}

	var req UpdateGroupRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	group, err := ctrl.groupService.UpdateGroup(uint(appID), uint(groupID), req.Name, req.Description, req.FilterRules, req.IsActive)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, group)
}

// DeleteGroup 删除分组
// @Summary 删除设备分组
// @Description 删除指定的设备分组
// @Tags 设备分组
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param id path int true "分组ID"
// @Success 200 {object} response.APIResponse "分组删除成功"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "未认证"
// @Failure 403 {object} response.APIResponse "无权限"
// @Failure 404 {object} response.APIResponse "分组不存在"
// @Router /apps/{appId}/device-groups/{id} [delete]
func (ctrl *GroupController) DeleteGroup(ctx *gin.Context) {
	appID, err := strconv.ParseUint(ctx.Param("appId"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的应用ID")
		return
	}

	groupID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(ctx, "无效的分组ID")
		return
	}

	err = ctrl.groupService.DeleteGroup(uint(appID), uint(groupID))
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	response.Success(ctx, gin.H{"message": "分组删除成功"})
}
