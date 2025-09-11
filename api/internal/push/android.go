package push

import (
	"bytes"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/doopush/doopush/api/internal/models"
	"github.com/golang-jwt/jwt/v5"
)

// AndroidProvider Android推送服务提供者
type AndroidProvider struct {
	channel    string
	config     AndroidProviderConfig
	httpClient *http.Client
}

// AndroidConfig Android 推送配置结构
type AndroidConfig struct {
	// FCM v1 API 配置
	ServiceAccountKey string `json:"service_account_key,omitempty"` // Firebase 服务账号密钥 JSON

	// 华为配置
	AppID     string `json:"app_id,omitempty"`     // 应用 ID
	AppKey    string `json:"app_key,omitempty"`    // 应用 Key
	AppSecret string `json:"app_secret,omitempty"` // 应用 Secret
}

// AndroidProviderConfig Android 推送提供者配置
type AndroidProviderConfig struct {
	// FCM v1 配置
	ServiceAccountKey string
	ProjectID         string

	// 华为配置
	AppID     string
	AppSecret string
}

// NewAndroidProvider 创建Android推送提供者
func NewAndroidProvider(channel string) *AndroidProvider {
	return &AndroidProvider{
		channel: channel,
		config:  AndroidProviderConfig{},
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// NewAndroidProviderWithConfig 使用配置创建Android推送提供者
func NewAndroidProviderWithConfig(channel string, config AndroidConfig) *AndroidProvider {
	// 从服务账号密钥中提取项目ID
	projectID := ""
	if config.ServiceAccountKey != "" {
		if extractedID, err := extractProjectIDFromServiceAccount(config.ServiceAccountKey); err == nil {
			projectID = extractedID
		}
	}

	return &AndroidProvider{
		channel: channel,
		config: AndroidProviderConfig{
			ServiceAccountKey: config.ServiceAccountKey,
			ProjectID:         projectID,
			AppID:             config.AppID,
			AppSecret:         config.AppSecret,
		},
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// extractProjectIDFromServiceAccount 从服务账号密钥JSON中提取项目ID
func extractProjectIDFromServiceAccount(serviceAccountKey string) (string, error) {
	var serviceAccount FirebaseServiceAccount
	if err := json.Unmarshal([]byte(serviceAccountKey), &serviceAccount); err != nil {
		return "", fmt.Errorf("解析服务账号密钥失败: %w", err)
	}

	if serviceAccount.ProjectID == "" {
		return "", fmt.Errorf("服务账号密钥中未找到 project_id")
	}

	return serviceAccount.ProjectID, nil
}

// FCMPayload FCM推送载荷
type FCMPayload struct {
	To           string                 `json:"to"`
	Notification FCMNotification        `json:"notification"`
	Data         map[string]interface{} `json:"data,omitempty"`
	Priority     string                 `json:"priority"`
}

// FCMNotification FCM通知内容
type FCMNotification struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Icon  string `json:"icon,omitempty"`
	Sound string `json:"sound,omitempty"`
	Badge string `json:"badge,omitempty"` // FCM的badge通常是字符串形式
}

// FCMv1Message FCM HTTP v1 API 消息格式
type FCMv1Message struct {
	Message FCMv1MessageBody `json:"message"`
}

// FCMv1MessageBody FCM v1 API 消息体
type FCMv1MessageBody struct {
	Token        string              `json:"token"`
	Notification *FCMv1Notification  `json:"notification,omitempty"`
	Data         map[string]string   `json:"data,omitempty"`
	Android      *FCMv1AndroidConfig `json:"android,omitempty"`
}

// FCMv1Notification FCM v1 API 通知结构
type FCMv1Notification struct {
	Title string `json:"title,omitempty"`
	Body  string `json:"body,omitempty"`
	Image string `json:"image,omitempty"`
}

// FCMv1AndroidConfig FCM v1 API Android 特定配置
type FCMv1AndroidConfig struct {
	CollapseKey  string                    `json:"collapse_key,omitempty"`
	Priority     string                    `json:"priority,omitempty"` // "normal" 或 "high"
	TTL          string                    `json:"ttl,omitempty"`      // 如 "3600s"
	Notification *FCMv1AndroidNotification `json:"notification,omitempty"`
	Data         map[string]string         `json:"data,omitempty"`
}

// FCMv1AndroidNotification FCM v1 API Android 通知配置
type FCMv1AndroidNotification struct {
	Title                 string   `json:"title,omitempty"`
	Body                  string   `json:"body,omitempty"`
	Icon                  string   `json:"icon,omitempty"`
	Color                 string   `json:"color,omitempty"`
	Sound                 string   `json:"sound,omitempty"`
	Tag                   string   `json:"tag,omitempty"`
	ClickAction           string   `json:"click_action,omitempty"`
	BodyLocKey            string   `json:"body_loc_key,omitempty"`
	BodyLocArgs           []string `json:"body_loc_args,omitempty"`
	TitleLocKey           string   `json:"title_loc_key,omitempty"`
	TitleLocArgs          []string `json:"title_loc_args,omitempty"`
	ChannelID             string   `json:"channel_id,omitempty"`
	Ticker                string   `json:"ticker,omitempty"`
	Sticky                bool     `json:"sticky,omitempty"`
	EventTime             string   `json:"event_time,omitempty"`
	LocalOnly             bool     `json:"local_only,omitempty"`
	Priority              string   `json:"notification_priority,omitempty"`
	DefaultSound          bool     `json:"default_sound,omitempty"`
	DefaultVibrateTimings bool     `json:"default_vibrate_timings,omitempty"`
	DefaultLightSettings  bool     `json:"default_light_settings,omitempty"`
	VibrateTimings        []string `json:"vibrate_timings,omitempty"`
	Visibility            string   `json:"visibility,omitempty"`
	NotificationCount     int      `json:"notification_count,omitempty"`
}

// HuaweiTokenResponse 华为 OAuth 令牌响应结构
type HuaweiTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope,omitempty"`
}

// HuaweiMessageRequest 华为推送请求结构 - 基于官方Demo
type HuaweiMessageRequest struct {
	ValidateOnly bool           `json:"validate_only"`
	Message      *HuaweiMessage `json:"message"`
}

// HuaweiMessage 华为推送消息体 - 基于官方Demo
type HuaweiMessage struct {
	Data         string               `json:"data,omitempty"`
	Notification *HuaweiNotification  `json:"notification,omitempty"`
	Android      *HuaweiAndroidConfig `json:"android,omitempty"`
	Token        []string             `json:"token,omitempty"`
	Topic        string               `json:"topic,omitempty"`
	Condition    string               `json:"condition,omitempty"`
}

// HuaweiNotification 华为推送通知结构
type HuaweiNotification struct {
	Title string `json:"title,omitempty"`
	Body  string `json:"body,omitempty"`
}

// HuaweiAndroidConfig 华为 Android 特定配置
type HuaweiAndroidConfig struct {
	CollapseKey   int                        `json:"collapse_key,omitempty"`
	Urgency       string                     `json:"urgency,omitempty"`
	Category      string                     `json:"category,omitempty"`
	TTL           string                     `json:"ttl,omitempty"`
	BiTag         string                     `json:"bi_tag,omitempty"`
	FastAppTarget int                        `json:"fast_app_target,omitempty"`
	Data          string                     `json:"data,omitempty"`
	Notification  *HuaweiAndroidNotification `json:"notification,omitempty"`
}

// HuaweiAndroidNotification 华为 Android 通知配置
type HuaweiAndroidNotification struct {
	Title             string               `json:"title,omitempty"`
	Body              string               `json:"body,omitempty"`
	Icon              string               `json:"icon,omitempty"`
	Color             string               `json:"color,omitempty"`
	Sound             string               `json:"sound,omitempty"`
	DefaultSound      bool                 `json:"default_sound,omitempty"`
	Tag               string               `json:"tag,omitempty"`
	ClickAction       *HuaweiClickAction   `json:"click_action,omitempty"`
	BodyLocKey        string               `json:"body_loc_key,omitempty"`
	BodyLocArgs       []string             `json:"body_loc_args,omitempty"`
	TitleLocKey       string               `json:"title_loc_key,omitempty"`
	TitleLocArgs      []string             `json:"title_loc_args,omitempty"`
	ChannelID         string               `json:"channel_id,omitempty"`
	NotifySummary     string               `json:"notify_summary,omitempty"`
	Image             string               `json:"image,omitempty"`
	Style             int                  `json:"style,omitempty"`
	BigTitle          string               `json:"big_title,omitempty"`
	BigBody           string               `json:"big_body,omitempty"`
	AutoClear         int                  `json:"auto_clear,omitempty"`
	NotifyID          int                  `json:"notify_id,omitempty"`
	Group             string               `json:"group,omitempty"`
	Badge             *HuaweiBadge         `json:"badge,omitempty"`
	Ticker            string               `json:"ticker,omitempty"`
	AutoCancel        bool                 `json:"auto_cancel,omitempty"`
	When              string               `json:"when,omitempty"`
	Importance        string               `json:"importance,omitempty"`
	UseDefaultVibrate bool                 `json:"use_default_vibrate,omitempty"`
	UseDefaultLight   bool                 `json:"use_default_light,omitempty"`
	VibrateConfig     []string             `json:"vibrate_config,omitempty"`
	Visibility        string               `json:"visibility,omitempty"`
	LightSettings     *HuaweiLightSettings `json:"light_settings,omitempty"`
	ForegroundShow    bool                 `json:"foreground_show,omitempty"`
	ProfileID         string               `json:"profile_id,omitempty"`
	Interruption      bool                 `json:"interruption,omitempty"`
}

// HuaweiClickAction 华为点击动作配置
type HuaweiClickAction struct {
	Type         int    `json:"type"`                    // 点击动作类型: 1-自定义动作，2-打开URL，3-打开APP
	Intent       string `json:"intent,omitempty"`        // 自定义intent
	URL          string `json:"url,omitempty"`           // 要打开的URL
	RichResource string `json:"rich_resource,omitempty"` // 富媒体地址
	Action       string `json:"action,omitempty"`        // 自定义行为
}

// HuaweiBadge 华为角标配置
type HuaweiBadge struct {
	AddNum int    `json:"add_num,omitempty"` // 角标数字
	SetNum int    `json:"set_num,omitempty"` // 设置角标数字
	Class  string `json:"class,omitempty"`   // 应用入口Activity类
}

// HuaweiLightSettings 华为灯光设置
type HuaweiLightSettings struct {
	Color            HuaweiColor `json:"color"`
	LightOnDuration  string      `json:"light_on_duration"`
	LightOffDuration string      `json:"light_off_duration"`
}

// HuaweiColor 华为颜色配置
type HuaweiColor struct {
	Alpha float32 `json:"alpha"`
	Red   float32 `json:"red"`
	Green float32 `json:"green"`
	Blue  float32 `json:"blue"`
}

// FirebaseServiceAccount Firebase 服务账号密钥结构
type FirebaseServiceAccount struct {
	Type                    string `json:"type"`
	ProjectID               string `json:"project_id"`
	PrivateKeyID            string `json:"private_key_id"`
	PrivateKey              string `json:"private_key"`
	ClientEmail             string `json:"client_email"`
	ClientID                string `json:"client_id"`
	AuthURI                 string `json:"auth_uri"`
	TokenURI                string `json:"token_uri"`
	AuthProviderX509CertURL string `json:"auth_provider_x509_cert_url"`
	ClientX509CertURL       string `json:"client_x509_cert_url"`
}

// FCMAccessTokenResponse FCM access token 响应
type FCMAccessTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
}

// FCMClaims FCM JWT Claims
type FCMClaims struct {
	Iss   string `json:"iss"`
	Sub   string `json:"sub"`
	Aud   string `json:"aud"`
	Scope string `json:"scope"`
	jwt.RegisteredClaims
}

// generateFCMAccessToken 生成 FCM access token
func (a *AndroidProvider) generateFCMAccessToken() (string, error) {
	// 解析服务账号密钥
	var serviceAccount FirebaseServiceAccount
	if err := json.Unmarshal([]byte(a.config.ServiceAccountKey), &serviceAccount); err != nil {
		return "", fmt.Errorf("解析服务账号密钥失败: %v", err)
	}

	// 解析私钥
	privateKey, err := parsePrivateKey(serviceAccount.PrivateKey)
	if err != nil {
		return "", fmt.Errorf("解析私钥失败: %v", err)
	}

	// 创建 JWT claims
	now := time.Now()
	claims := FCMClaims{
		Iss:   serviceAccount.ClientEmail,
		Sub:   serviceAccount.ClientEmail,
		Aud:   "https://oauth2.googleapis.com/token",
		Scope: "https://www.googleapis.com/auth/cloud-platform",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
		},
	}

	// 生成 JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = serviceAccount.PrivateKeyID

	jwtToken, err := token.SignedString(privateKey)
	if err != nil {
		return "", fmt.Errorf("生成 JWT token 失败: %v", err)
	}

	// 获取 OAuth 2.0 access token
	return a.getOAuthAccessToken(jwtToken)
}

// parsePrivateKey 解析 RSA 私钥
func parsePrivateKey(privateKeyData string) (*rsa.PrivateKey, error) {
	// 解码 PEM 格式私钥
	block, _ := pem.Decode([]byte(privateKeyData))
	if block == nil {
		return nil, fmt.Errorf("无法解码 PEM 私钥")
	}

	// 尝试解析 PKCS1 格式
	if privateKey, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return privateKey, nil
	}

	// 尝试解析 PKCS8 格式
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
		return nil, fmt.Errorf("私钥不是 RSA 格式")
	}

	return nil, fmt.Errorf("不支持的私钥格式")
}

// getOAuthAccessToken 获取 OAuth 2.0 access token
func (a *AndroidProvider) getOAuthAccessToken(jwtToken string) (string, error) {
	// 准备请求数据
	data := url.Values{}
	data.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	data.Set("assertion", jwtToken)

	// 创建请求
	req, err := http.NewRequest("POST", "https://oauth2.googleapis.com/token", strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("创建 OAuth 请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// 发送请求
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("OAuth 请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取 OAuth 响应失败: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("OAuth 请求失败，状态码: %d, 响应: %s", resp.StatusCode, string(body))
	}

	// 解析响应
	var tokenResponse FCMAccessTokenResponse
	if err := json.Unmarshal(body, &tokenResponse); err != nil {
		return "", fmt.Errorf("解析 OAuth 响应失败: %v", err)
	}

	return tokenResponse.AccessToken, nil
}

// SendPush 发送Android推送
func (a *AndroidProvider) SendPush(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	switch a.channel {
	case "fcm":
		return a.sendFCM(device, pushLog)
	case "huawei":
		return a.sendHuawei(device, pushLog)
	case "xiaomi":
		return a.sendXiaomi(device, pushLog)
	case "oppo":
		return a.sendOPPO(device, pushLog)
	case "vivo":
		return a.sendVIVO(device, pushLog)
	default:
		result := &models.PushResult{
			AppID:        pushLog.AppID,
			PushLogID:    pushLog.ID,
			Success:      false,
			ErrorCode:    "UNSUPPORTED_CHANNEL",
			ErrorMessage: fmt.Sprintf("不支持的推送通道: %s", a.channel),
			ResponseData: "{}", // 初始化为空 JSON 对象
		}
		return result
	}
}

// sendFCM 发送FCM推送
func (a *AndroidProvider) sendFCM(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	// 生成 access token
	accessToken, err := a.generateFCMAccessToken()
	if err != nil {
		return &models.PushResult{
			AppID:        pushLog.AppID,
			PushLogID:    pushLog.ID,
			Success:      false,
			ErrorCode:    "FCM_AUTH_ERROR",
			ErrorMessage: fmt.Sprintf("FCM 认证失败: %v", err),
			ResponseData: "{}",
		}
	}

	// 构建自定义数据
	dataMap := make(map[string]string)
	if pushLog.Payload != "" {
		var customData map[string]interface{}
		if err := json.Unmarshal([]byte(pushLog.Payload), &customData); err == nil {
			for k, v := range customData {
				// 将所有值转换为字符串（FCM v1 API 要求）
				if str, ok := v.(string); ok {
					dataMap[k] = str
				} else {
					dataMap[k] = fmt.Sprintf("%v", v)
				}
			}
		}
	}

	// 添加统计标识字段
	dataMap["badge"] = fmt.Sprintf("%d", pushLog.Badge)
	dataMap["push_log_id"] = fmt.Sprintf("%d", pushLog.ID)
	if pushLog.DedupKey != "" {
		dataMap["dedup_key"] = pushLog.DedupKey
	}
	dataMap["dp_source"] = "doopush"

	// 构建 FCM v1 API 载荷
	message := FCMv1Message{
		Message: FCMv1MessageBody{
			Token: device.Token,
			Notification: &FCMv1Notification{
				Title: pushLog.Title,
				Body:  pushLog.Content,
			},
			Data: dataMap,
			Android: &FCMv1AndroidConfig{
				Priority: "high",
				Notification: &FCMv1AndroidNotification{
					Title:             pushLog.Title,
					Body:              pushLog.Content,
					Sound:             "default",
					ClickAction:       "FLUTTER_NOTIFICATION_CLICK",
					NotificationCount: pushLog.Badge,
				},
			},
		},
	}

	// 序列化载荷
	payloadBytes, err := json.Marshal(message)
	if err != nil {
		return &models.PushResult{
			AppID:        pushLog.AppID,
			PushLogID:    pushLog.ID,
			Success:      false,
			ErrorCode:    "PAYLOAD_ERROR",
			ErrorMessage: fmt.Sprintf("载荷序列化失败: %v", err),
			ResponseData: "{}",
		}
	}

	// 构建 FCM v1 API 请求 URL
	requestURL := fmt.Sprintf("https://fcm.googleapis.com/v1/projects/%s/messages:send", a.config.ProjectID)

	// 创建 HTTP 请求
	req, err := http.NewRequest("POST", requestURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return &models.PushResult{
			AppID:        pushLog.AppID,
			PushLogID:    pushLog.ID,
			Success:      false,
			ErrorCode:    "REQUEST_ERROR",
			ErrorMessage: fmt.Sprintf("创建请求失败: %v", err),
			ResponseData: "{}",
		}
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	// 发送请求
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return &models.PushResult{
			AppID:        pushLog.AppID,
			PushLogID:    pushLog.ID,
			Success:      false,
			ErrorCode:    "NETWORK_ERROR",
			ErrorMessage: fmt.Sprintf("网络请求失败: %v", err),
			ResponseData: "{}",
		}
	}
	defer resp.Body.Close()

	// 读取响应
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return &models.PushResult{
			AppID:        pushLog.AppID,
			PushLogID:    pushLog.ID,
			Success:      false,
			ErrorCode:    "RESPONSE_ERROR",
			ErrorMessage: fmt.Sprintf("读取响应失败: %v", err),
			ResponseData: "{}",
		}
	}

	// 解析响应状态
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		ResponseData: string(respBody),
	}

	if resp.StatusCode == http.StatusOK {
		result.Success = true
		fmt.Printf("FCM 推送成功: %s -> %s\n", device.Token[:min(20, len(device.Token))]+"...", pushLog.Title)
	} else {
		result.Success = false
		result.ErrorCode = fmt.Sprintf("HTTP_%d", resp.StatusCode)

		// 尝试解析 FCM 错误响应
		var fcmError struct {
			Error struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
				Status  string `json:"status"`
			} `json:"error"`
		}

		if err := json.Unmarshal(respBody, &fcmError); err == nil && fcmError.Error.Message != "" {
			result.ErrorMessage = fcmError.Error.Message
			if fcmError.Error.Status != "" {
				result.ErrorCode = fcmError.Error.Status
			}
		} else {
			result.ErrorMessage = fmt.Sprintf("FCM 推送失败，HTTP 状态码: %d", resp.StatusCode)
		}

		fmt.Printf("FCM 推送失败: %s, 错误: %s\n", result.ErrorCode, result.ErrorMessage)
	}

	return result
}

// min 辅助函数，返回两个整数的最小值
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// sendHuawei 发送华为推送
func (a *AndroidProvider) sendHuawei(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      false,
		ResponseData: "{}",
	}

	// 获取 access token
	accessToken, err := a.getHuaweiAccessToken()
	if err != nil {
		result.ErrorCode = "AUTH_ERROR"
		result.ErrorMessage = fmt.Sprintf("华为认证失败: %v", err)
		return result
	}

	// 构建推送消息
	message := a.buildHuaweiMessage(device, pushLog)

	// 发送推送
	err = a.sendHuaweiMessage(accessToken, message)
	if err != nil {
		result.ErrorCode = "SEND_ERROR"
		result.ErrorMessage = fmt.Sprintf("华为推送发送失败: %v", err)
		return result
	}

	result.Success = true
	result.ResponseData = `{"message_id":"success"}`
	fmt.Printf("✅ 华为推送发送成功: %s -> %s (badge: %d)\n",
		device.Token[:min(20, len(device.Token))]+"...", pushLog.Title, pushLog.Badge)

	return result
}

// getHuaweiAccessToken 获取华为OAuth 2.0 access token
func (a *AndroidProvider) getHuaweiAccessToken() (string, error) {
	// 华为OAuth 2.0 token endpoint
	tokenURL := "https://oauth-login.cloud.huawei.com/oauth2/v2/token"

	// 准备请求参数
	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", a.config.AppID)
	data.Set("client_secret", a.config.AppSecret)

	// 创建请求
	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("创建华为认证请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// 发送请求
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("华为认证请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取华为认证响应失败: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("华为认证失败，状态码: %d, 响应: %s", resp.StatusCode, string(body))
	}

	// 解析响应
	var tokenResponse HuaweiTokenResponse
	if err := json.Unmarshal(body, &tokenResponse); err != nil {
		return "", fmt.Errorf("解析华为认证响应失败: %v", err)
	}

	if tokenResponse.AccessToken == "" {
		return "", fmt.Errorf("华为认证响应中缺少access_token")
	}

	return tokenResponse.AccessToken, nil
}

// buildHuaweiMessage 构建华为推送消息
func (a *AndroidProvider) buildHuaweiMessage(device *models.Device, pushLog *models.PushLog) *HuaweiMessageRequest {
	// 构建简单的通知内容
	notification := &HuaweiNotification{
		Title: pushLog.Title,
		Body:  pushLog.Content,
	}

	// 解析华为特有参数
	importance := "NORMAL" // 默认为服务通讯类消息，避免频控
	category := "IM"       // 默认为即时通讯分类

	// 从pushLog.Payload中解析华为特有参数
	if pushLog.Payload != "" && pushLog.Payload != "{}" {
		var payloadMap map[string]interface{}
		if err := json.Unmarshal([]byte(pushLog.Payload), &payloadMap); err == nil {
			if hwData, ok := payloadMap["huawei"].(map[string]interface{}); ok {
				if imp, ok := hwData["importance"].(string); ok && imp != "" {
					importance = imp
				}
				if cat, ok := hwData["category"].(string); ok && cat != "" {
					category = cat
				}
			}
		}
	}

	// 构建Android配置 - 添加必需的ClickAction和华为特有参数
	androidConfig := &HuaweiAndroidConfig{
		Urgency:  "HIGH",
		TTL:      "86400s",
		Category: category, // 华为自定义分类，避免频控
		Notification: &HuaweiAndroidNotification{
			Title:        pushLog.Title,
			Body:         pushLog.Content,
			DefaultSound: true,
			ChannelID:    "default",
			Importance:   importance, // 华为消息分类，NORMAL=服务通讯类，LOW=资讯营销类
			// 华为推送要求通知消息必须包含ClickAction
			ClickAction: &HuaweiClickAction{
				Type:   1,        // 1=intent/action (打开应用)
				Action: "Action", // 默认Action，基于官方Demo
			},
			// 华为角标支持 - 设置角标数量（仅在角标>=0时设置）
			Badge: func() *HuaweiBadge {
				if pushLog.Badge >= 0 {
					return &HuaweiBadge{
						SetNum: pushLog.Badge, // 设置角标数量（不是增加）
						Class:  "",            // 应用入口Activity类，留空使用默认
					}
				}
				return nil // 角标<0时不设置
			}(),
		},
	}

	// 构建消息体 - 基于官方Demo格式
	message := &HuaweiMessage{
		Notification: notification,
		Android:      androidConfig,
		Token:        []string{device.Token},
	}

	// 返回完整的请求结构
	return &HuaweiMessageRequest{
		ValidateOnly: false,
		Message:      message,
	}
}

// HuaweiResponse 华为推送响应结构
type HuaweiResponse struct {
	Code      string `json:"code"`
	Msg       string `json:"msg"`
	RequestID string `json:"requestId"`
}

// sendHuaweiMessage 发送华为推送消息
func (a *AndroidProvider) sendHuaweiMessage(accessToken string, message *HuaweiMessageRequest) error {
	// 华为推送API endpoint
	pushURL := fmt.Sprintf("https://push-api.cloud.huawei.com/v1/%s/messages:send", a.config.AppID)

	// 序列化消息
	messageJSON, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("序列化华为推送消息失败: %v", err)
	}

	// 输出调试信息
	fmt.Printf("华为推送请求体: %s\n", string(messageJSON))

	// 创建请求
	req, err := http.NewRequest("POST", pushURL, bytes.NewBuffer(messageJSON))
	if err != nil {
		return fmt.Errorf("创建华为推送请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/json; charset=UTF-8")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))

	// 发送请求
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("华为推送请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("读取华为推送响应失败: %v", err)
	}

	// 解析华为响应
	var huaweiResp HuaweiResponse
	if err := json.Unmarshal(body, &huaweiResp); err != nil {
		return fmt.Errorf("解析华为推送响应失败: %v, 原始响应: %s", err, string(body))
	}

	// 输出响应用于调试
	fmt.Printf("华为推送响应: %s\n", string(body))

	// 检查华为的响应码
	if huaweiResp.Code != "80000000" {
		return fmt.Errorf("华为推送失败，错误码: %s, 错误信息: %s", huaweiResp.Code, huaweiResp.Msg)
	}

	return nil
}

// sendXiaomi 发送小米推送
func (a *AndroidProvider) sendXiaomi(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      time.Now().UnixNano()%100 < 85, // 85%成功率
		ResponseData: "{}",                           // 初始化为空 JSON 对象
	}

	if result.Success {
		fmt.Printf("模拟小米推送成功: %s -> %s (badge: %d)\n", device.Token[:20]+"...", pushLog.Title, pushLog.Badge)
	} else {
		result.ErrorCode = "MIPUSH_ERROR"
		result.ErrorMessage = "小米推送服务暂时不可用"
	}

	return result
}

// sendOPPO 发送OPPO推送
func (a *AndroidProvider) sendOPPO(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      time.Now().UnixNano()%100 < 75, // 75%成功率
		ResponseData: "{}",                           // 初始化为空 JSON 对象
	}

	if result.Success {
		fmt.Printf("模拟OPPO推送成功: %s -> %s (badge: %d)\n", device.Token[:20]+"...", pushLog.Title, pushLog.Badge)
	} else {
		result.ErrorCode = "OPPO_ERROR"
		result.ErrorMessage = "OPPO推送服务暂时不可用"
	}

	return result
}

// sendVIVO 发送VIVO推送
func (a *AndroidProvider) sendVIVO(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      time.Now().UnixNano()%100 < 70, // 70%成功率
		ResponseData: "{}",                           // 初始化为空 JSON 对象
	}

	if result.Success {
		fmt.Printf("模拟VIVO推送成功: %s -> %s (badge: %d)\n", device.Token[:20]+"...", pushLog.Title, pushLog.Badge)
	} else {
		result.ErrorCode = "VIVO_ERROR"
		result.ErrorMessage = "VIVO推送服务暂时不可用"
	}

	return result
}
