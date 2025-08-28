package push

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/net/http2"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
)

// APNsProvider iOS推送服务提供者
type APNsProvider struct {
	client      *http.Client
	environment string // development 或 production
	authType    string // p8 或 p12

	// P8密钥认证相关
	keyID      string
	teamID     string
	bundleID   string
	privateKey *ecdsa.PrivateKey

	// P12证书认证相关
	cert tls.Certificate
}

// APNsConfig APNs配置结构
type APNsConfig struct {
	// 通用配置
	Environment string `json:"environment"` // development 或 production
	BundleID    string `json:"bundle_id"`   // 应用Bundle ID

	// P8密钥认证（推荐）
	AuthKeyP8  string `json:"auth_key_p8,omitempty"` // P8私钥内容
	PrivateKey string `json:"private_key,omitempty"` // 前端兼容字段名
	KeyID      string `json:"key_id,omitempty"`      // 密钥ID
	TeamID     string `json:"team_id,omitempty"`     // 团队ID
	Production *bool  `json:"production,omitempty"`  // 前端兼容字段（布尔值）

	// P12证书认证（传统）
	CertPEM    string `json:"cert_pem,omitempty"`    // 证书PEM
	KeyPEM     string `json:"key_pem,omitempty"`     // 私钥PEM
	CertP12    string `json:"cert_p12,omitempty"`    // P12证书（Base64）
	CertPasswd string `json:"cert_passwd,omitempty"` // P12密码
}

// NewAPNsProvider 创建APNs推送提供者
func NewAPNsProvider(certPEM, keyPEM []byte, environment string) (*APNsProvider, error) {
	// 兼容旧接口，使用P12证书方式
	cert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		return nil, fmt.Errorf("加载APNs证书失败: %v", err)
	}

	return NewAPNsProviderWithCert(cert, environment, "")
}

// NewAPNsProviderWithConfig 根据配置创建APNs推送提供者
func NewAPNsProviderWithConfig(config APNsConfig) (*APNsProvider, error) {
	// 规范化配置字段，兼容前端字段名
	normalizeConfig(&config)

	// 优先使用P8密钥认证
	if config.AuthKeyP8 != "" && config.KeyID != "" && config.TeamID != "" {
		return NewAPNsProviderWithP8(config.AuthKeyP8, config.KeyID, config.TeamID, config.BundleID, config.Environment)
	}

	// 使用P12证书认证
	if config.CertPEM != "" && config.KeyPEM != "" {
		cert, err := tls.X509KeyPair([]byte(config.CertPEM), []byte(config.KeyPEM))
		if err != nil {
			return nil, fmt.Errorf("加载APNs证书失败: %v", err)
		}
		return NewAPNsProviderWithCert(cert, config.Environment, config.BundleID)
	}

	return nil, fmt.Errorf("未提供有效的APNs认证配置")
}

// normalizeConfig 规范化配置字段，兼容前端字段名
func normalizeConfig(config *APNsConfig) {
	// 前端 private_key -> 后端 auth_key_p8
	if config.PrivateKey != "" && config.AuthKeyP8 == "" {
		config.AuthKeyP8 = config.PrivateKey
	}

	// 前端 production -> 后端 environment
	if config.Production != nil {
		if *config.Production {
			config.Environment = "production"
		} else {
			config.Environment = "development"
		}
	} else if config.Environment == "" {
		// 默认开发环境
		config.Environment = "development"
	}
}

// NewAPNsProviderWithP8 使用P8密钥创建APNs推送提供者（推荐）
func NewAPNsProviderWithP8(keyP8, keyID, teamID, bundleID, environment string) (*APNsProvider, error) {
	// 解析P8私钥
	privateKey, err := parseP8PrivateKey([]byte(keyP8))
	if err != nil {
		return nil, fmt.Errorf("解析P8私钥失败: %v", err)
	}

	// 创建HTTP/2客户端
	client := &http.Client{
		Transport: &http2.Transport{
			TLSClientConfig: &tls.Config{
				ServerName: getAPNsHost(environment),
			},
		},
		Timeout: 30 * time.Second,
	}

	return &APNsProvider{
		client:      client,
		environment: environment,
		authType:    "p8",
		keyID:       keyID,
		teamID:      teamID,
		bundleID:    bundleID,
		privateKey:  privateKey,
	}, nil
}

// NewAPNsProviderWithCert 使用证书创建APNs推送提供者
func NewAPNsProviderWithCert(cert tls.Certificate, environment, bundleID string) (*APNsProvider, error) {
	// 创建TLS配置
	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		ServerName:   getAPNsHost(environment),
	}

	// 创建HTTP/2客户端
	transport := &http2.Transport{
		TLSClientConfig: tlsConfig,
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   30 * time.Second,
	}

	return &APNsProvider{
		client:      client,
		environment: environment,
		authType:    "p12",
		bundleID:    bundleID,
		cert:        cert,
	}, nil
}

// parseP8PrivateKey 解析P8私钥
func parseP8PrivateKey(keyData []byte) (*ecdsa.PrivateKey, error) {
	// 解析PEM格式
	block, _ := pem.Decode(keyData)
	if block == nil {
		return nil, fmt.Errorf("无效的PEM格式")
	}

	// 解析PKCS8私钥
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("解析PKCS8私钥失败: %v", err)
	}

	// 确保是ECDSA私钥（APNs要求）
	ecdsaKey, ok := key.(*ecdsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("APNs需要ECDSA私钥，但得到了: %T", key)
	}

	return ecdsaKey, nil
}

// getAPNsHost 获取APNs服务器主机名
func getAPNsHost(environment string) string {
	if environment == "production" {
		return "api.push.apple.com"
	}
	return "api.development.push.apple.com"
}

// getAPNsURL 获取APNs服务器URL
func getAPNsURL(environment string) string {
	if environment == "production" {
		return "https://api.push.apple.com/3/device/"
	}
	return "https://api.development.push.apple.com/3/device/"
}

// APNsPayload APNs推送载荷
type APNsPayload struct {
	Aps        APNsAps                `json:"aps"`
	CustomData map[string]interface{} `json:",inline"`
}

// APNsAps APNs标准载荷
type APNsAps struct {
	Alert            interface{} `json:"alert,omitempty"`
	Badge            int         `json:"badge,omitempty"`
	Sound            string      `json:"sound,omitempty"`
	ContentAvailable int         `json:"content-available,omitempty"`
	Category         string      `json:"category,omitempty"`
	ThreadID         string      `json:"thread-id,omitempty"`
}

// APNsAlert APNs通知内容
type APNsAlert struct {
	Title    string `json:"title,omitempty"`
	Body     string `json:"body,omitempty"`
	Subtitle string `json:"subtitle,omitempty"`
}

// SendPush 发送APNs推送
func (a *APNsProvider) SendPush(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	// 构建 APNs 标准 aps 字段
	apsMap := map[string]interface{}{
		"alert": map[string]interface{}{
			"title": pushLog.Title,
			"body":  pushLog.Content,
		},
		"sound": "default",
		"badge": a.calculateBadgeCount(device.ID),
	}

	// 顶层载荷对象（根级字典），自定义键与统计标识合并在顶层
	payloadMap := map[string]interface{}{"aps": apsMap}

	// 合并自定义数据到顶层（避免嵌入额外层级）
	if pushLog.Payload != "" {
		var customData map[string]interface{}
		if err := json.Unmarshal([]byte(pushLog.Payload), &customData); err == nil {
			for k, v := range customData {
				if k == "aps" { // 避免覆盖标准字段
					continue
				}
				payloadMap[k] = v
			}
		}
	}

	// 注入统计标识，供客户端上报使用
	payloadMap["push_log_id"] = pushLog.ID
	if pushLog.DedupKey != "" {
		payloadMap["dedup_key"] = pushLog.DedupKey
	}
	payloadMap["dp_source"] = "doopush"

	// 序列化载荷
	payloadJSON, err := json.Marshal(payloadMap)
	if err != nil {
		return &models.PushResult{
			AppID:        pushLog.AppID,
			PushLogID:    pushLog.ID,
			Success:      false,
			ErrorCode:    "PAYLOAD_ERROR",
			ErrorMessage: "载荷序列化失败",
			ResponseData: "{}", // 初始化为空 JSON 对象
		}
	}

	// 构建请求URL
	requestURL := getAPNsURL(a.environment) + device.Token

	// 创建HTTP请求
	req, err := http.NewRequest("POST", requestURL, bytes.NewBuffer(payloadJSON))
	if err != nil {
		return &models.PushResult{
			AppID:        pushLog.AppID,
			PushLogID:    pushLog.ID,
			Success:      false,
			ErrorCode:    "REQUEST_ERROR",
			ErrorMessage: "创建请求失败: " + err.Error(),
			ResponseData: "{}", // 初始化为空 JSON 对象
		}
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apns-priority", "10")
	req.Header.Set("apns-expiration", "0")

	// 设置Bundle ID（如果配置了）
	if a.bundleID != "" {
		req.Header.Set("apns-topic", a.bundleID)
	}

	// 根据认证类型设置认证头
	if a.authType == "p8" {
		// 使用JWT认证
		token, err := a.generateJWT()
		if err != nil {
			return &models.PushResult{
				AppID:        pushLog.AppID,
				PushLogID:    pushLog.ID,
				Success:      false,
				ErrorCode:    "AUTH_ERROR",
				ErrorMessage: "生成JWT失败: " + err.Error(),
				ResponseData: "{}", // 初始化为空 JSON 对象
			}
		}
		req.Header.Set("authorization", "bearer "+token)
	}
	// P12证书认证已在HTTP客户端TLS配置中处理

	// 发送请求
	resp, err := a.client.Do(req)
	if err != nil {
		return &models.PushResult{
			AppID:        pushLog.AppID,
			PushLogID:    pushLog.ID,
			Success:      false,
			ErrorCode:    "NETWORK_ERROR",
			ErrorMessage: "网络请求失败: " + err.Error(),
			ResponseData: "{}", // 初始化为空 JSON 对象
		}
	}
	defer resp.Body.Close()

	// 读取响应
	responseBody, _ := io.ReadAll(resp.Body)

	// 处理响应
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		ResponseData: "{}", // 初始化为空 JSON 对象
	}

	// 设置响应数据
	if len(responseBody) > 0 {
		result.ResponseData = string(responseBody)
	}

	if resp.StatusCode == 200 {
		// 推送成功
		result.Success = true
		result.ErrorCode = ""
		result.ErrorMessage = ""

		fmt.Printf("✅ APNs推送成功: %s -> %s\n", device.Token[:20]+"...", pushLog.Title)
	} else {
		// 推送失败，解析错误信息
		result.Success = false

		var apnsError APNsErrorResponse
		if json.Unmarshal(responseBody, &apnsError) == nil {
			result.ErrorCode = apnsError.Reason
			result.ErrorMessage = apnsError.Reason + " (HTTP " + fmt.Sprintf("%d", resp.StatusCode) + ")"
		} else {
			result.ErrorCode = fmt.Sprintf("HTTP_%d", resp.StatusCode)
			result.ErrorMessage = fmt.Sprintf("APNs返回状态码: %d", resp.StatusCode)
		}

		fmt.Printf("❌ APNs推送失败: %s -> %s (%s)\n",
			device.Token[:20]+"...", pushLog.Title, result.ErrorMessage)
	}

	return result
}

// generateJWT 生成JWT认证token（用于P8密钥认证）
func (a *APNsProvider) generateJWT() (string, error) {
	if a.authType != "p8" || a.privateKey == nil {
		return "", fmt.Errorf("未配置P8密钥认证")
	}

	// 创建JWT claims
	now := time.Now()
	claims := jwt.MapClaims{
		"iss": a.teamID,
		"iat": now.Unix(),
		"exp": now.Add(time.Hour).Unix(), // 1小时后过期
	}

	// 创建token
	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	token.Header["kid"] = a.keyID

	// 签名token
	return token.SignedString(a.privateKey)
}

// APNsErrorResponse APNs错误响应
type APNsErrorResponse struct {
	Reason    string `json:"reason"`
	Timestamp int64  `json:"timestamp,omitempty"`
}

// TestConnection 测试APNs连接（用于配置验证）
func (a *APNsProvider) TestConnection() error {
	// 构建测试载荷（空载荷）
	payload := map[string]interface{}{
		"aps": map[string]interface{}{
			"alert": "test",
		},
	}

	payloadJSON, _ := json.Marshal(payload)

	// 使用无效的设备token进行连接测试
	testURL := getAPNsURL(a.environment) + "00000000000000000000000000000000"

	req, err := http.NewRequest("POST", testURL, bytes.NewBuffer(payloadJSON))
	if err != nil {
		return fmt.Errorf("创建测试请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if a.bundleID != "" {
		req.Header.Set("apns-topic", a.bundleID)
	}

	// 设置认证
	if a.authType == "p8" {
		token, err := a.generateJWT()
		if err != nil {
			return fmt.Errorf("JWT认证失败: %v", err)
		}
		req.Header.Set("authorization", "bearer "+token)
	}

	// 发送请求
	resp, err := a.client.Do(req)
	if err != nil {
		return fmt.Errorf("连接APNs失败: %v", err)
	}
	defer resp.Body.Close()

	// 检查响应状态，400是预期的（因为使用了无效token）
	// 401表示认证失败，403表示证书问题
	if resp.StatusCode == 401 {
		return fmt.Errorf("APNs认证失败，请检查证书或密钥配置")
	}
	if resp.StatusCode == 403 {
		return fmt.Errorf("APNs授权失败，请检查Bundle ID或证书权限")
	}

	// 400或200都表示连接成功（只是token无效）
	return nil
}

// calculateBadgeCount 计算设备的未读推送数量
func (a *APNsProvider) calculateBadgeCount(deviceID uint) int {
	var count int64

	// 统计该设备所有未点击且推送成功的消息
	// 注意：这里会统计当前推送之前的未读数量，当前推送发送成功后还会+1
	err := database.DB.Model(&models.PushLog{}).
		Joins("LEFT JOIN push_results ON push_logs.id = push_results.push_log_id").
		Where("push_logs.device_id = ? AND push_logs.is_clicked = ? AND push_results.success = ?",
			deviceID, false, true).
		Count(&count).Error

	if err != nil {
		// 计算失败时返回默认值1，确保推送正常进行
		fmt.Printf("❌ Badge计算失败: %v，使用默认值1\n", err)
		return 1
	}

	// 当前推送如果成功，需要+1
	count = count + 1

	// 限制最大badge数量，避免显示过大的数字
	if count > 99 {
		return 99
	}

	// 至少显示1
	if count <= 0 {
		return 1
	}

	return int(count)
}
