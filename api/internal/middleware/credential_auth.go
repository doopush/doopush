package middleware

import (
	"crypto/subtle"
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

func pathAppID(c *gin.Context) (uint, bool) {
	value, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		c.Abort()
		return 0, false
	}
	return uint(value), true
}

// AppKeyAuth 用于客户端 SDK 接口。App Key 是公开接入标识，不授予服务端推送权限。
func AppKeyAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		appID, ok := pathAppID(c)
		if !ok {
			return
		}
		provided := c.GetHeader("X-App-Key")
		if provided == "" {
			response.Unauthorized(c, "缺少App Key")
			c.Abort()
			return
		}
		var app models.App
		if err := database.DB.Where("id = ? AND status = 1", appID).First(&app).Error; err != nil {
			response.Unauthorized(c, "应用不存在或已禁用")
			c.Abort()
			return
		}
		if subtle.ConstantTimeCompare([]byte(provided), []byte(app.AppKey)) != 1 {
			response.Unauthorized(c, "App Key无效或与应用不匹配")
			c.Abort()
			return
		}
		c.Set("app_id", appID)
		c.Set("auth_type", "app_key")
		c.Next()
	}
}

// JWTOrAppSecretAuth 用于服务端业务 API。JWT 代表控制台用户，App Secret 代表机器身份。
func JWTOrAppSecretAuth() gin.HandlerFunc {
	jwtService := auth.NewJWTService(config.GetString("JWT_SECRET"), config.GetString("JWT_ISSUER"))
	return func(c *gin.Context) {
		parts := strings.SplitN(c.GetHeader("Authorization"), " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			response.Unauthorized(c, "需要Bearer Token或App Secret")
			c.Abort()
			return
		}
		if claims, err := jwtService.ValidateToken(parts[1]); err == nil {
			c.Set("user_id", claims.UserID)
			c.Set("username", claims.Username)
			c.Set("email", claims.Email)
			c.Set("claims", claims)
			c.Set("auth_type", "jwt")
			c.Next()
			return
		}

		appID, ok := pathAppID(c)
		if !ok {
			return
		}
		var secret models.AppSecret
		err := database.DB.Where("app_id = ? AND secret_hash = ? AND status = 1 AND revoked_at IS NULL", appID, utils.HashCredential(parts[1])).First(&secret).Error
		if err != nil || (secret.ExpiresAt != nil && secret.ExpiresAt.Before(time.Now())) {
			response.Unauthorized(c, "App Secret无效或已过期")
			c.Abort()
			return
		}
		var app models.App
		if err := database.DB.Select("id").Where("id = ? AND status = 1", appID).First(&app).Error; err != nil {
			response.Unauthorized(c, "应用不存在或已禁用")
			c.Abort()
			return
		}
		c.Set("auth_type", "app_secret")
		c.Set("app_id", appID)
		c.Set("app_secret_id", secret.ID)
		c.Set("app_secret_scopes", secret.Scopes)
		now := time.Now()
		_ = database.DB.Model(&secret).Where("last_used_at IS NULL OR last_used_at < ?", now.Add(-5*time.Minute)).Updates(map[string]interface{}{
			"last_used_at": now, "last_used_ip": c.ClientIP(),
		}).Error
		c.Next()
	}
}

func RequireAppSecretScopes(scopes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if EnsureAppSecretScopes(c, scopes...) {
			c.Next()
		}
	}
}

// EnsureAppSecretScopes 允许控制器根据请求内容追加动态权限检查。
func EnsureAppSecretScopes(c *gin.Context, scopes ...string) bool {
	if c.GetString("auth_type") != "app_secret" {
		return true
	}
	granted, _ := c.Get("app_secret_scopes")
	list, ok := granted.(models.StringList)
	if !ok {
		response.Forbidden(c, "App Secret权限信息无效")
		c.Abort()
		return false
	}
	for _, scope := range scopes {
		if !list.Contains(scope) {
			response.Forbidden(c, "App Secret缺少权限: "+scope)
			c.Abort()
			return false
		}
	}
	return true
}
