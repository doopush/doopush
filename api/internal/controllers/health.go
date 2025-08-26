package controllers

import (
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// HealthController 健康检查控制器
type HealthController struct{}

// NewHealthController 创建健康检查控制器
func NewHealthController() *HealthController {
	return &HealthController{}
}

// Check 健康检查
// @Summary 健康检查
// @Description 检查API服务状态
// @Tags 系统
// @Accept json
// @Produce json
// @Success 200 {object} response.APIResponse
// @Router /health [get]
func (h *HealthController) Check(c *gin.Context) {
	response.Success(c, gin.H{
		"status":  "ok",
		"service": "doopush",
		"version": "1.0.0",
	})
}
