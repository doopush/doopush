package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// APIResponse 统一响应格式
type APIResponse struct {
	Code    int         `json:"code" example:"200"`
	Message string      `json:"message" example:"成功"`
	Data    interface{} `json:"data,omitempty"`
}

// Success 成功响应
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, APIResponse{
		Code:    200,
		Message: "成功",
		Data:    data,
	})
}

// Error 错误响应
func Error(c *gin.Context, code int, message string) {
	c.JSON(code, APIResponse{
		Code:    code,
		Message: message,
	})
}

// BadRequest 400错误
func BadRequest(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, message)
}

// Unauthorized 401错误
func Unauthorized(c *gin.Context, message string) {
	Error(c, http.StatusUnauthorized, message)
}

// Forbidden 403错误
func Forbidden(c *gin.Context, message string) {
	Error(c, http.StatusForbidden, message)
}

// NotFound 404错误
func NotFound(c *gin.Context, message string) {
	Error(c, http.StatusNotFound, message)
}

// InternalServerError 500错误
func InternalServerError(c *gin.Context, message string) {
	Error(c, http.StatusInternalServerError, message)
}
