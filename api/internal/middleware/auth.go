package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/doopush/doopush/api/internal/config"
	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/auth"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/doopush/doopush/api/pkg/utils"
	"github.com/gin-gonic/gin"
)

// JWTAuth JWT认证中间件
func JWTAuth() gin.HandlerFunc {
	jwtService := auth.NewJWTService(
		config.GetString("JWT_SECRET"),
		config.GetString("JWT_ISSUER"),
	)

	return func(c *gin.Context) {
		// 获取Authorization头
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "缺少Authorization头")
			c.Abort()
			return
		}

		// 检查Bearer前缀
		tokenParts := strings.SplitN(authHeader, " ", 2)
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			response.Unauthorized(c, "Authorization格式错误")
			c.Abort()
			return
		}

		// 验证JWT令牌
		claims, err := jwtService.ValidateToken(tokenParts[1])
		if err != nil {
			response.Unauthorized(c, "无效的JWT令牌")
			c.Abort()
			return
		}

		// 将用户信息存储到上下文
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("email", claims.Email)
		c.Set("claims", claims)

		c.Next()
	}
}

// APIKeyAuth API密钥认证中间件
func APIKeyAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取API Key (支持Header和Query参数)
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			apiKey = c.Query("api_key")
		}

		if apiKey == "" {
			response.Unauthorized(c, "缺少API密钥")
			c.Abort()
			return
		}

		// 简单验证API密钥格式
		if len(apiKey) < 10 {
			response.Unauthorized(c, "无效的API密钥")
			c.Abort()
			return
		}

		// 获取应用ID参数（如果存在）
		appIDStr := c.Param("appId")
		if appIDStr != "" {
			appID, err := strconv.ParseUint(appIDStr, 10, 32)
			if err != nil {
				response.BadRequest(c, "无效的应用ID")
				c.Abort()
				return
			}

			// 验证API Key是否属于该应用
			if !validateAPIKeyForApp(apiKey, uint(appID)) {
				response.Unauthorized(c, "API密钥与应用不匹配")
				c.Abort()
				return
			}
		}

		// 将API密钥存储到上下文
		c.Set("api_key", apiKey)

		c.Next()
	}
}

// OptionalAuth 可选认证中间件 (支持JWT和API Key)
func OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 尝试JWT认证
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			tokenParts := strings.SplitN(authHeader, " ", 2)
			if len(tokenParts) == 2 && tokenParts[0] == "Bearer" {
				jwtService := auth.NewJWTService(
					config.GetString("JWT_SECRET"),
					config.GetString("JWT_ISSUER"),
				)

				if claims, err := jwtService.ValidateToken(tokenParts[1]); err == nil {
					c.Set("user_id", claims.UserID)
					c.Set("username", claims.Username)
					c.Set("auth_type", "jwt")
					c.Next()
					return
				}
			}
		}

		// 尝试API Key认证
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			apiKey = c.Query("api_key")
		}
		if apiKey != "" {
			// 简单格式验证
			if len(apiKey) >= 10 {
				c.Set("api_key", apiKey)
				c.Set("auth_type", "api_key")
				c.Next()
				return
			}
		}

		// 无认证信息时继续执行（可选认证）
		c.Set("auth_type", "none")
		c.Next()
	}
}

// RequireAuth 强制认证中间件
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authType := c.GetString("auth_type")
		if authType == "none" || authType == "" {
			response.Unauthorized(c, "需要认证")
			c.Abort()
			return
		}
		c.Next()
	}
}

// CORS 跨域中间件
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// validateAPIKeyForApp 验证API Key是否属于指定应用
func validateAPIKeyForApp(apiKey string, appID uint) bool {
	// 计算API Key的哈希值
	keyHash := utils.HashString(apiKey)

	// 查询数据库验证API Key
	var appAPIKey models.AppAPIKey
	err := database.DB.Where("app_id = ? AND key_hash = ? AND status = 1", appID, keyHash).First(&appAPIKey).Error

	// 如果找到对应记录且未过期，则验证通过
	if err == nil {
		// 检查是否过期
		if appAPIKey.ExpiresAt != nil && appAPIKey.ExpiresAt.Before(time.Now()) {
			return false // 密钥已过期
		}

		// 异步更新最后使用时间
		go func() {
			now := time.Now()
			database.DB.Model(&appAPIKey).Update("last_used", &now)
		}()

		return true
	}

	return false
}
