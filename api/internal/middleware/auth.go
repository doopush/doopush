package middleware

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/doopush/doopush/api/internal/config"
	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/auth"
	"github.com/doopush/doopush/api/pkg/response"
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

// OptionalAuth 可选 JWT 认证中间件
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

// RequireAppRole 校验当前 JWT 用户对路径中应用的最低角色权限。
func RequireAppRole(requiredRole string) gin.HandlerFunc {
	roleLevel := map[string]int{"viewer": 1, "developer": 2, "owner": 3}
	requiredLevel, valid := roleLevel[requiredRole]

	return func(c *gin.Context) {
		if !valid {
			response.InternalServerError(c, "无效的权限配置")
			c.Abort()
			return
		}
		appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
		if err != nil {
			response.BadRequest(c, "无效的应用ID")
			c.Abort()
			return
		}

		var permission models.UserAppPermission
		if err := database.DB.Where("user_id = ? AND app_id = ?", c.GetUint("user_id"), uint(appID)).First(&permission).Error; err != nil {
			response.Forbidden(c, "无权限访问该应用")
			c.Abort()
			return
		}
		if roleLevel[permission.Role] < requiredLevel {
			response.Forbidden(c, "应用权限不足")
			c.Abort()
			return
		}
		c.Set("app_id", uint(appID))
		c.Set("app_role", permission.Role)
		c.Next()
	}
}

// CORS 跨域中间件
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
