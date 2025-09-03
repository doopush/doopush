package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/gin-gonic/gin"
)

// AuditLogger 审计日志中间件
func AuditLogger() gin.HandlerFunc {
	auditService := services.NewAuditService()

	return func(c *gin.Context) {
		// 检查是否需要记录审计日志
		if !shouldAudit(c) {
			c.Next()
			return
		}

		// 记录请求开始时间
		start := time.Now()

		// 读取请求体（用于记录详情）
		var requestBody []byte
		if c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			// 重新设置请求体，以免影响后续处理
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		// 执行后续中间件和处理函数
		c.Next()

		// 异步记录审计日志，避免影响响应性能
		go func() {
			logAuditAction(auditService, c, requestBody, start)
		}()
	}
}

// shouldAudit 判断是否需要记录审计日志
func shouldAudit(c *gin.Context) bool {
	method := c.Request.Method
	path := c.Request.URL.Path

	// 只记录非只读操作
	if method == "GET" || method == "HEAD" || method == "OPTIONS" {
		return false
	}

	// 排除一些不需要记录的路径
	excludePaths := []string{
		"/health",
		"/metrics",
		"/swagger",
		"/favicon.ico",
		"/static/",
		"/assets/",
		"/api/v1/auth/refresh", // 刷新token不需要记录
	}

	for _, excludePath := range excludePaths {
		if strings.HasPrefix(path, excludePath) {
			return false
		}
	}

	// 只记录API请求
	if !strings.HasPrefix(path, "/api/") {
		return false
	}

	return true
}

// logAuditAction 记录审计操作
func logAuditAction(auditService *services.AuditService, c *gin.Context, requestBody []byte, startTime time.Time) {
	// 获取用户信息
	userID := c.GetUint("user_id")
	if userID == 0 {
		return // 没有用户信息，跳过记录
	}

	// 获取应用ID（如果存在）
	var appID *uint
	if appIDStr := c.Param("appId"); appIDStr != "" {
		if id, err := strconv.ParseUint(appIDStr, 10, 64); err == nil {
			appIDValue := uint(id)
			appID = &appIDValue
		}
	}

	// 解析操作类型和资源
	action, resource, resourceID := parseActionFromRequest(c)
	if action == "" {
		return // 无法解析操作类型，跳过记录
	}

	// 获取客户端IP地址
	ipAddress := getClientIP(c)

	// 获取User-Agent
	userAgent := c.GetHeader("User-Agent")

	// 构建操作详情
	details := buildRequestDetails(c, requestBody)

	// 记录审计日志
	err := auditService.LogActionWithContext(
		userID,
		appID,
		action,
		resource,
		resourceID,
		ipAddress,
		userAgent,
		nil, // 目前不记录变更前数据，可以后续扩展
		details,
	)

	if err != nil {
		// 记录失败不影响主流程，只在内部记录错误
		// 可以考虑添加到错误日志或监控系统
	}
}

// parseActionFromRequest 从HTTP请求中解析操作类型和资源
func parseActionFromRequest(c *gin.Context) (action, resource, resourceID string) {
	method := c.Request.Method
	path := c.Request.URL.Path

	// 根据HTTP方法映射操作类型
	switch method {
	case "POST":
		action = "create"
	case "PUT", "PATCH":
		action = "update"
	case "DELETE":
		action = "delete"
	default:
		return "", "", ""
	}

	// 从路径中解析资源类型和ID
	// 路径格式通常为: /api/v1/apps/{appId}/resource/{resourceId}
	pathParts := strings.Split(strings.Trim(path, "/"), "/")

	if len(pathParts) >= 3 {
		// 寻找资源名称
		for i, part := range pathParts {
			switch part {
			case "apps":
				if action == "create" && len(pathParts) == i+1 {
					resource = "app"
				} else if len(pathParts) > i+1 {
					resource = "app"
					if len(pathParts) > i+2 {
						resourceID = pathParts[i+1]
					}
				}
			case "devices":
				resource = "device"
				if len(pathParts) > i+1 && isNumeric(pathParts[i+1]) {
					resourceID = pathParts[i+1]
				}
			case "push":
				resource = "push"
				if strings.Contains(path, "/push/") && len(pathParts) > i+1 {
					// 可能是推送相关操作
					if pathParts[i+1] == "single" || pathParts[i+1] == "batch" || pathParts[i+1] == "broadcast" {
						action = "push"
					}
				}
			case "templates":
				resource = "template"
				if len(pathParts) > i+1 && isNumeric(pathParts[i+1]) {
					resourceID = pathParts[i+1]
				}
			case "config":
				resource = "config"
			case "groups":
				resource = "group"
				if len(pathParts) > i+1 && isNumeric(pathParts[i+1]) {
					resourceID = pathParts[i+1]
				}
			case "scheduled-push":
				resource = "scheduled_push"
				if len(pathParts) > i+1 && isNumeric(pathParts[i+1]) {
					resourceID = pathParts[i+1]
				}
			}
		}
	}

	// 特殊处理登录登出
	if strings.Contains(path, "/auth/login") {
		action = "login"
		resource = "user"
	} else if strings.Contains(path, "/auth/logout") {
		action = "logout"
		resource = "user"
	}

	return action, resource, resourceID
}

// getClientIP 获取客户端真实IP地址
func getClientIP(c *gin.Context) string {
	// 尝试从各种header中获取真实IP
	headers := []string{
		"X-Forwarded-For",
		"X-Real-IP",
		"X-Client-IP",
		"CF-Connecting-IP", // Cloudflare
	}

	for _, header := range headers {
		ip := c.GetHeader(header)
		if ip != "" {
			// X-Forwarded-For可能包含多个IP，取第一个
			if strings.Contains(ip, ",") {
				ip = strings.TrimSpace(strings.Split(ip, ",")[0])
			}

			// 验证IP格式
			if net.ParseIP(ip) != nil {
				return ip
			}
		}
	}

	// 如果没有代理header，使用连接的远程地址
	ip, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		return c.Request.RemoteAddr
	}

	return ip
}

// buildRequestDetails 构建请求详情
func buildRequestDetails(c *gin.Context, requestBody []byte) map[string]interface{} {
	details := map[string]interface{}{
		"method":      c.Request.Method,
		"path":        c.Request.URL.Path,
		"status_code": c.Writer.Status(),
		"request_id":  c.GetHeader("X-Request-ID"),
	}

	// 如果有请求体且不是敏感信息，记录部分内容
	if len(requestBody) > 0 && c.GetHeader("Content-Type") == "application/json" {
		var jsonBody map[string]interface{}
		if err := json.Unmarshal(requestBody, &jsonBody); err == nil {
			// 过滤敏感字段
			filteredBody := filterSensitiveFields(jsonBody)
			details["request_body"] = filteredBody
		}
	}

	// 记录查询参数（过滤敏感参数）
	if len(c.Request.URL.RawQuery) > 0 {
		params := make(map[string]string)
		for key, values := range c.Request.URL.Query() {
			if !isSensitiveParam(key) && len(values) > 0 {
				params[key] = values[0]
			}
		}
		if len(params) > 0 {
			details["query_params"] = params
		}
	}

	return details
}

// filterSensitiveFields 过滤敏感字段
func filterSensitiveFields(data map[string]interface{}) map[string]interface{} {
	sensitiveFields := []string{
		"password", "pwd", "secret", "token", "key", "api_key",
		"authorization", "auth", "credential", "private_key",
	}

	filtered := make(map[string]interface{})
	for key, value := range data {
		keyLower := strings.ToLower(key)
		isSensitive := false

		for _, sensitive := range sensitiveFields {
			if strings.Contains(keyLower, sensitive) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			filtered[key] = "[FILTERED]"
		} else {
			filtered[key] = value
		}
	}

	return filtered
}

// isSensitiveParam 判断是否为敏感查询参数
func isSensitiveParam(param string) bool {
	sensitiveParams := []string{
		"password", "token", "api_key", "secret", "key",
		"authorization", "auth", "credential",
	}

	paramLower := strings.ToLower(param)
	for _, sensitive := range sensitiveParams {
		if strings.Contains(paramLower, sensitive) {
			return true
		}
	}

	return false
}

// isNumeric 判断字符串是否为数字
func isNumeric(s string) bool {
	_, err := strconv.Atoi(s)
	return err == nil
}
