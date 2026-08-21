package controllers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

type CreateAppSecretRequest struct {
	Name      string     `json:"name" binding:"required,max=100"`
	Scopes    []string   `json:"scopes" binding:"required,min=1"`
	ExpiresAt *time.Time `json:"expires_at"`
}

type UpdateAppSecretScopesRequest struct {
	Scopes []string `json:"scopes" binding:"required,min=1"`
}

func (a *AppController) GetAppSecrets(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}
	secrets, err := services.NewCredentialService().ListAppSecrets(uint(appID))
	if err != nil {
		response.InternalServerError(c, "获取App Secret失败")
		return
	}
	response.Success(c, secrets)
}

func (a *AppController) CreateAppSecret(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}
	var req CreateAppSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}
	secret, plain, err := services.NewCredentialService().CreateAppSecret(uint(appID), c.GetUint("user_id"), req.Name, req.Scopes, req.ExpiresAt)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	c.Set("audit_resource_id", secret.ID)
	c.JSON(http.StatusCreated, response.APIResponse{Code: http.StatusCreated, Message: "App Secret创建成功", Data: gin.H{
		"app_secret":  plain,
		"secret_info": secret,
		"warning":     "App Secret仅展示一次，请立即保存到服务端密钥管理系统",
	}})
}

func (a *AppController) UpdateAppSecretScopes(c *gin.Context) {
	appID, appErr := strconv.ParseUint(c.Param("appId"), 10, 32)
	secretID, secretErr := strconv.ParseUint(c.Param("secretId"), 10, 32)
	if appErr != nil || secretErr != nil {
		response.BadRequest(c, "无效的应用或Secret ID")
		return
	}

	var req UpdateAppSecretScopesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	secret, previousScopes, err := services.NewCredentialService().UpdateAppSecretScopes(uint(appID), uint(secretID), req.Scopes)
	if err != nil {
		if errors.Is(err, services.ErrAppSecretNotFound) {
			response.NotFound(c, err.Error())
		} else {
			response.BadRequest(c, err.Error())
		}
		return
	}

	c.Set("audit_before_data", gin.H{"scopes": previousScopes})
	c.Set("audit_after_data", gin.H{"scopes": secret.Scopes})
	response.Success(c, secret)
}

func (a *AppController) RevokeAppSecret(c *gin.Context) {
	appID, appErr := strconv.ParseUint(c.Param("appId"), 10, 32)
	secretID, secretErr := strconv.ParseUint(c.Param("secretId"), 10, 32)
	if appErr != nil || secretErr != nil {
		response.BadRequest(c, "无效的应用或Secret ID")
		return
	}
	if err := services.NewCredentialService().RevokeAppSecret(uint(appID), uint(secretID)); err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "App Secret已撤销"})
}
