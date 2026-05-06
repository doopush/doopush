package gateway

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
	"gorm.io/gorm"
)

// HandshakeParams 握手 query 三参
type HandshakeParams struct {
	AppID  uint
	AppKey string
	Token  string
}

var errMissingParam = errors.New("missing required query param")

// parseHandshakeParams 从请求 query 中解析三参
func parseHandshakeParams(r *http.Request) (*HandshakeParams, error) {
	q := r.URL.Query()
	appIDStr := q.Get("appid")
	appKey := q.Get("appkey")
	token := q.Get("token")
	if appIDStr == "" || appKey == "" || token == "" {
		return nil, errMissingParam
	}
	id, err := strconv.ParseUint(appIDStr, 10, 32)
	if err != nil {
		return nil, fmt.Errorf("invalid appid: %w", err)
	}
	return &HandshakeParams{AppID: uint(id), AppKey: appKey, Token: token}, nil
}

// authError 携带 HTTP status hint 的鉴权错误
type authError struct {
	status int
	msg    string
}

func (e *authError) Error() string { return e.msg }

// authenticate 校验三参；返回设备 ID（成功）或 error（失败）
func authenticate(db *gorm.DB, p *HandshakeParams) (deviceID uint, err error) {
	// 1. App 存在且启用
	var app models.App
	if err := db.Where("id = ? AND status = 1", p.AppID).First(&app).Error; err != nil {
		return 0, &authError{status: http.StatusUnauthorized, msg: "app not found"}
	}
	// 2. AppKey 哈希匹配
	keyHash := utils.HashString(p.AppKey)
	var apiKey models.AppAPIKey
	if err := db.Where("app_id = ? AND key_hash = ? AND status = 1", p.AppID, keyHash).First(&apiKey).Error; err != nil {
		return 0, &authError{status: http.StatusUnauthorized, msg: "invalid appkey"}
	}
	if apiKey.ExpiresAt != nil && apiKey.ExpiresAt.Before(time.Now()) {
		return 0, &authError{status: http.StatusUnauthorized, msg: "appkey expired"}
	}
	// 3. 设备 token 哈希匹配
	tokenHash := utils.HashString(p.Token)
	var device models.Device
	if err := db.Where("app_id = ? AND token_hash = ? AND status = 1", p.AppID, tokenHash).First(&device).Error; err != nil {
		return 0, &authError{status: http.StatusForbidden, msg: "invalid token"}
	}
	return device.ID, nil
}

// AuthenticateRequest HTTP 层入口，握手前调用
func AuthenticateRequest(r *http.Request) (*HandshakeParams, uint, error) {
	p, err := parseHandshakeParams(r)
	if err != nil {
		return nil, 0, &authError{status: http.StatusBadRequest, msg: err.Error()}
	}
	deviceID, err := authenticate(database.DB, p)
	if err != nil {
		// pass *authError through; wrap any other error as 500
		var ae *authError
		if errors.As(err, &ae) {
			return nil, 0, ae
		}
		return nil, 0, &authError{status: http.StatusInternalServerError, msg: err.Error()}
	}
	return p, deviceID, nil
}

// HTTPStatus returns the HTTP status code from an auth error, or 500 if err is not an auth error.
func HTTPStatus(err error) int {
	var ae *authError
	if errors.As(err, &ae) {
		return ae.status
	}
	return http.StatusInternalServerError
}
