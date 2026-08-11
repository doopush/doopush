package controllers

import (
	"errors"
	"net/http"
	"net/mail"
	"strconv"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

type InvitationController struct {
	service *services.InvitationService
}

func NewInvitationController() *InvitationController {
	return &InvitationController{service: services.NewInvitationService()}
}

type CreateInvitationRequest struct {
	InviteeID uint   `json:"invitee_id" binding:"required"`
	Role      string `json:"role" binding:"required,oneof=owner developer viewer"`
}

func (ctrl *InvitationController) LookupCandidate(c *gin.Context) {
	appID, ok := parseAppID(c)
	if !ok {
		return
	}
	email := c.Query("email")
	if _, err := mail.ParseAddress(email); err != nil {
		response.BadRequest(c, "请输入完整有效的邮箱")
		return
	}
	candidate, err := ctrl.service.LookupCandidate(appID, c.GetUint("user_id"), email)
	if err != nil {
		handleInvitationError(c, err)
		return
	}
	response.Success(c, candidate)
}

func (ctrl *InvitationController) CreateInvitation(c *gin.Context) {
	appID, ok := parseAppID(c)
	if !ok {
		return
	}
	var req CreateInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请选择有效的用户和角色")
		return
	}
	invitation, err := ctrl.service.CreateInvitation(appID, c.GetUint("user_id"), req.InviteeID, req.Role)
	if err != nil {
		handleInvitationError(c, err)
		return
	}
	c.JSON(http.StatusCreated, response.APIResponse{
		Code: http.StatusCreated, Message: "邀请已发送", Data: invitation,
	})
}

func (ctrl *InvitationController) GetPendingInvitations(c *gin.Context) {
	appID, ok := parseAppID(c)
	if !ok {
		return
	}
	invitations, err := ctrl.service.GetPendingInvitations(appID, c.GetUint("user_id"))
	if err != nil {
		handleInvitationError(c, err)
		return
	}
	response.Success(c, invitations)
}

func (ctrl *InvitationController) CancelInvitation(c *gin.Context) {
	appID, ok := parseAppID(c)
	if !ok {
		return
	}
	invitationID, err := strconv.ParseUint(c.Param("invitationId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的邀请ID")
		return
	}
	if err := ctrl.service.CancelInvitation(appID, c.GetUint("user_id"), uint(invitationID)); err != nil {
		handleInvitationError(c, err)
		return
	}
	response.Success(c, nil)
}

func (ctrl *InvitationController) GetInbox(c *gin.Context) {
	invitations, err := ctrl.service.GetInbox(c.GetUint("user_id"))
	if err != nil {
		handleInvitationError(c, err)
		return
	}
	response.Success(c, invitations)
}

func (ctrl *InvitationController) GetUnreadCount(c *gin.Context) {
	count, err := ctrl.service.GetUnreadCount(c.GetUint("user_id"))
	if err != nil {
		response.InternalServerError(c, "获取未读数量失败")
		return
	}
	response.Success(c, gin.H{"count": count})
}

func (ctrl *InvitationController) MarkRead(c *gin.Context) {
	invitationID, ok := parseInvitationID(c)
	if !ok {
		return
	}
	if err := ctrl.service.MarkRead(c.GetUint("user_id"), invitationID); err != nil {
		handleInvitationError(c, err)
		return
	}
	response.Success(c, nil)
}

func (ctrl *InvitationController) MarkAllRead(c *gin.Context) {
	if err := ctrl.service.MarkAllRead(c.GetUint("user_id")); err != nil {
		handleInvitationError(c, err)
		return
	}
	response.Success(c, nil)
}

func (ctrl *InvitationController) AcceptInvitation(c *gin.Context) {
	ctrl.respond(c, true)
}

func (ctrl *InvitationController) RejectInvitation(c *gin.Context) {
	ctrl.respond(c, false)
}

func (ctrl *InvitationController) respond(c *gin.Context, accept bool) {
	invitationID, ok := parseInvitationID(c)
	if !ok {
		return
	}
	invitation, err := ctrl.service.RespondInvitation(c.GetUint("user_id"), invitationID, accept)
	if err != nil {
		handleInvitationError(c, err)
		return
	}
	response.Success(c, invitation)
}

func parseInvitationID(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(c.Param("invitationId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的邀请ID")
		return 0, false
	}
	return uint(id), true
}

func handleInvitationError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrEmailUserNotFound), errors.Is(err, services.ErrInvitationNotFound):
		response.NotFound(c, err.Error())
	case errors.Is(err, services.ErrPendingInvitationExists), errors.Is(err, services.ErrCannotInviteMember):
		response.Error(c, http.StatusConflict, err.Error())
	case errors.Is(err, services.ErrInvitationNotPending), errors.Is(err, services.ErrInvalidAppRole):
		response.BadRequest(c, err.Error())
	case err.Error() == "无权限管理应用成员":
		response.Forbidden(c, err.Error())
	default:
		response.InternalServerError(c, err.Error())
	}
}
