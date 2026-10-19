package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// uploadSVGCSP 上传的 SVG 可内嵌脚本：禁止执行脚本，仅作为图片展示
const uploadSVGCSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox"

// UploadsSecurityHeaders 上传文件的安全响应头（与 conf/nginx.conf 的 /uploads/ 保持一致）
func UploadsSecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		if strings.HasSuffix(strings.ToLower(c.Request.URL.Path), ".svg") {
			c.Header("Content-Security-Policy", uploadSVGCSP)
		}
		c.Next()
	}
}
