package push

import (
	"bytes"
	"crypto/md5"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/doopush/doopush/api/internal/models"
	"github.com/golang-jwt/jwt/v5"
)

// AndroidProvider Android推送服务提供者
type AndroidProvider struct {
	channel         string
	config          AndroidProviderConfig
	httpClient      *http.Client
	oppoAuthClient  *OppoAuthClient  // OPPO认证客户端
	vivoAuthClient  *VivoAuthClient  // VIVO认证客户端
	honorAuthClient *HonorAuthClient // 荣耀认证客户端
	authMutex       sync.Mutex       // 认证互斥锁
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

	// 华为和小米配置
	AppID     string
	AppKey    string // 小米推送需要
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

	provider := &AndroidProvider{
		channel: channel,
		config: AndroidProviderConfig{
			ServiceAccountKey: config.ServiceAccountKey,
			ProjectID:         projectID,
			AppID:             config.AppID,
			AppKey:            config.AppKey,
			AppSecret:         config.AppSecret,
		},
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}

	// 为OPPO推送初始化认证客户端
	if channel == "oppo" && config.AppKey != "" && config.AppSecret != "" {
		provider.oppoAuthClient = &OppoAuthClient{
			appKey:       config.AppKey,
			masterSecret: config.AppSecret,
		}
	}

	// 为VIVO推送初始化认证客户端
	if channel == "vivo" && config.AppID != "" && config.AppKey != "" && config.AppSecret != "" {
		provider.vivoAuthClient = &VivoAuthClient{
			appID:     config.AppID,
			appKey:    config.AppKey,
			appSecret: config.AppSecret,
		}
	}

	// 为荣耀推送初始化认证客户端
	if channel == "honor" && config.AppID != "" && config.AppSecret != "" {
		provider.honorAuthClient = &HonorAuthClient{
			clientID:     config.AppID,
			clientSecret: config.AppSecret,
		}
	}

	return provider
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

// 小米推送相关数据结构

// OPPO推送常量
const (
	oppoHost    = "https://api.push.oppomobile.com"
	oppoAuthURL = "/server/v1/auth"
	oppoSendURL = "/server/v1/message/notification/unicast"
)

// VIVO推送常量
const (
	vivoHost    = "https://api-push.vivo.com.cn"
	vivoAuthURL = "/message/auth"
	vivoSendURL = "/message/send"
)

// OppoAuthClient OPPO认证客户端（单例模式管理token）
type OppoAuthClient struct {
	appKey            string
	masterSecret      string
	authToken         string
	authTokenExpireAt int64
}

// OppoMessage OPPO推送消息结构（对应官方SendReq）
type OppoMessage struct {
	TargetType           int               `json:"target_type,omitempty"`  // 目标类型 2: registration_id  5:别名
	TargetValue          string            `json:"target_value,omitempty"` // 推送目标用户: registration_id或alias
	Notification         *OppoNotification `json:"notification,omitempty"` // 通知栏消息
	VerifyRegistrationId bool              `json:"verify_registration_id"` // 消息到达客户端后是否校验registration_id
}

// OppoNotification OPPO通知栏消息结构
type OppoNotification struct {
	AppMessageID     string `json:"app_message_id,omitempty"`    // App开发者自定义消息Id，主要用于消息去重
	Style            int    `json:"style,omitempty"`             // 通知栏样式 1. 标准样式 2. 长文本样式 3. 大图样式
	Title            string `json:"title,omitempty"`             // 设置在通知栏展示的通知栏标题
	SubTitle         string `json:"sub_title,omitempty"`         // 子标题
	Content          string `json:"content,omitempty"`           // 设置在通知栏展示的通知的正文内容
	ClickActionType  int    `json:"click_action_type,omitempty"` // 点击通知栏后触发的动作类型
	ActionParameters string `json:"action_parameters,omitempty"` // 跳转动作参数（JSON格式）
	OffLine          bool   `json:"off_line"`                    // 是否是离线消息
	OffLineTTL       int    `json:"off_line_ttl,omitempty"`      // 离线消息的存活时间，单位是秒
	ChannelID        string `json:"channel_id,omitempty"`        // 指定下发的通道ID
	Category         string `json:"category,omitempty"`          // 通道类别名
	NotifyLevel      int    `json:"notify_level,omitempty"`      // 通知栏消息提醒等级
}

// OppoAuthRequest OPPO认证请求结构
type OppoAuthRequest struct {
	AppKey    string `json:"app_key,omitempty"`   // OPPO PUSH发放给合法应用的AppKey
	Sign      string `json:"sign,omitempty"`      // 加密签名
	Timestamp string `json:"timestamp,omitempty"` // 当前时间的unix时间戳
}

// OppoAuthResponse OPPO认证响应结构
type OppoAuthResponse struct {
	Code    int    `json:"code"`    // 返回码
	Message string `json:"message"` // 错误详细信息
	Data    struct {
		AuthToken  string `json:"auth_token"`  // 权限令牌
		CreateTime int64  `json:"create_time"` // 时间毫秒数
	} `json:"data"` // 返回值
}

// OppoSendResponse OPPO推送响应结构
type OppoSendResponse struct {
	Code    int    `json:"code"`    // 返回码
	Message string `json:"message"` // 错误详细信息
	Data    struct {
		MessageID string `json:"messageId"` // 消息 ID
	} `json:"data"` // 返回值
}

// VivoAuthClient VIVO认证客户端
type VivoAuthClient struct {
	appID             string
	appKey            string
	appSecret         string
	authToken         string
	authTokenExpireAt int64
}

// HonorAuthClient 荣耀认证客户端
type HonorAuthClient struct {
	clientID      string
	clientSecret  string
	accessToken   string
	tokenExpireAt int64
}

// VivoMessage VIVO推送消息结构
type VivoMessage struct {
	RegID           string            `json:"regId"`                     // 目标设备注册ID
	Title           string            `json:"title"`                     // 通知标题
	Content         string            `json:"content"`                   // 通知内容
	NotifyType      int               `json:"notifyType"`                // 通知类型: 1=通知栏, 2=透传
	TimeToLive      int               `json:"timeToLive"`                // 离线保存时长(秒)
	SkipType        int               `json:"skipType"`                  // 跳转类型: 1=打开应用, 2=打开URL, 3=自定义
	SkipContent     string            `json:"skipContent,omitempty"`     // 跳转内容
	NetworkType     int               `json:"networkType"`               // 网络类型: -1=不限制, 1=WiFi
	Classification  int               `json:"classification"`            // 消息分类: 0=运营消息, 1=系统消息
	RequestID       string            `json:"requestId"`                 // 请求ID，用于去重
	ClientCustomMap map[string]string `json:"clientCustomMap,omitempty"` // 自定义透传参数
}

// VivoAuthRequest VIVO认证请求结构
type VivoAuthRequest struct {
	AppID     string `json:"appId"`     // VIVO应用ID
	AppKey    string `json:"appKey"`    // VIVO应用Key
	Timestamp int64  `json:"timestamp"` // 时间戳（毫秒）
	Sign      string `json:"sign"`      // MD5签名
}

// VivoAuthResponse VIVO认证响应结构
type VivoAuthResponse struct {
	Result    int    `json:"result"`    // 返回码：0=成功
	Desc      string `json:"desc"`      // 描述信息
	AuthToken string `json:"authToken"` // 认证token
	ValidTime int64  `json:"validTime"` // token有效期（毫秒）
}

// HonorAuthResponse 荣耀认证响应结构
type HonorAuthResponse struct {
	AccessToken string `json:"access_token"` // 应用级Access Token
	ExpiresIn   int    `json:"expires_in"`   // Access Token的剩余有效期，单位：秒
	TokenType   string `json:"token_type"`   // 固定返回Bearer
}

// VivoSendResponse VIVO推送响应结构
type VivoSendResponse struct {
	Result int    `json:"result"` // 返回码：0=成功
	Desc   string `json:"desc"`   // 描述信息
	TaskID string `json:"taskId"` // 任务ID
}

// HonorMessageRequest 荣耀推送消息请求结构
type HonorMessageRequest struct {
	Data         string              `json:"data,omitempty"`
	Notification *HonorNotification  `json:"notification,omitempty"`
	Android      *HonorAndroidConfig `json:"android,omitempty"`
	Token        []string            `json:"token,omitempty"`
}

// HonorNotification 荣耀推送通知结构
type HonorNotification struct {
	Title string `json:"title,omitempty"`
	Body  string `json:"body,omitempty"`
	Image string `json:"image,omitempty"`
}

// HonorAndroidConfig 荣耀 Android 特定配置
type HonorAndroidConfig struct {
	TTL            string                    `json:"ttl,omitempty"`
	BiTag          string                    `json:"biTag,omitempty"`
	Data           string                    `json:"data,omitempty"`
	Notification   *HonorAndroidNotification `json:"notification,omitempty"`
	TargetUserType int                       `json:"targetUserType,omitempty"`
}

// HonorAndroidNotification 荣耀 Android 通知配置
type HonorAndroidNotification struct {
	Title       string                  `json:"title,omitempty"`
	Body        string                  `json:"body,omitempty"`
	ClickAction *HonorClickAction       `json:"clickAction,omitempty"`
	Image       string                  `json:"image,omitempty"`
	Style       int                     `json:"style,omitempty"`
	BigTitle    string                  `json:"bigTitle,omitempty"`
	BigBody     string                  `json:"bigBody,omitempty"`
	Importance  string                  `json:"importance,omitempty"`
	When        string                  `json:"when,omitempty"`
	Buttons     []*HonorButton          `json:"buttons,omitempty"`
	Badge       *HonorBadgeNotification `json:"badge,omitempty"`
	NotifyId    int                     `json:"notifyId,omitempty"`
	Tag         string                  `json:"tag,omitempty"`
	Group       string                  `json:"group,omitempty"`
}

// HonorClickAction 荣耀点击行为配置
type HonorClickAction struct {
	Type   int    `json:"type"`             // 点击行为类型：1=自定义页面 2=URL 3=打开应用
	Intent string `json:"intent,omitempty"` // 自定义页面intent
	URL    string `json:"url,omitempty"`    // 特定URL
	Action string `json:"action,omitempty"` // action方式打开页面
}

// HonorButton 荣耀按钮配置
type HonorButton struct {
	Name       string `json:"name"`                 // 按钮名称
	ActionType int    `json:"actionType"`           // 按钮动作类型：0=打开应用首页 1=自定义页面 2=网页
	IntentType int    `json:"intentType,omitempty"` // 打开自定义页面方式：0=intent 1=action
	Intent     string `json:"intent,omitempty"`     // intent或URL
	Data       string `json:"data,omitempty"`       // 透传数据
}

// HonorBadgeNotification 荣耀角标配置
type HonorBadgeNotification struct {
	AddNum     int    `json:"addNum,omitempty"` // 角标累加数字
	BadgeClass string `json:"badgeClass"`       // 应用入口Activity类全路径
	SetNum     int    `json:"setNum,omitempty"` // 角标设置数字
}

// HonorSendResponse 荣耀推送响应结构
type HonorSendResponse struct {
	Code    int            `json:"code"`              // 响应码
	Message string         `json:"message,omitempty"` // 响应信息
	Data    *HonorSendData `json:"data,omitempty"`    // 请求返回的结果
}

// HonorSendData 荣耀推送响应数据
type HonorSendData struct {
	SendResult   bool     `json:"sendResult"`             // 推送消息的结果
	RequestId    string   `json:"requestId,omitempty"`    // 请求ID
	FailTokens   []string `json:"failTokens,omitempty"`   // 推送失败的pushTokens
	ExpireTokens []string `json:"expireTokens,omitempty"` // 失效的pushTokens
}

// XiaomiMessage 小米推送消息结构
type XiaomiMessage struct {
	Title                 string                 `json:"title,omitempty"`                   // 通知标题
	Description           string                 `json:"description,omitempty"`             // 通知内容
	Payload               string                 `json:"payload,omitempty"`                 // 自定义载荷数据
	RestrictedPackageName string                 `json:"restricted_package_name,omitempty"` // 应用包名
	PassThrough           int                    `json:"pass_through,omitempty"`            // 是否透传消息：0=通知消息，1=透传消息
	NotifyType            int                    `json:"notify_type,omitempty"`             // 提醒类型：1=声音，2=震动，4=指示灯
	TimeToLive            int64                  `json:"time_to_live,omitempty"`            // 消息存活时间(ms)
	NotifyID              int                    `json:"notify_id,omitempty"`               // 通知ID，用于消息去重
	ChannelID             string                 `json:"channel_id,omitempty"`              // 推送通道ID：用于指定推送通道类型
	Extra                 map[string]interface{} `json:"extra,omitempty"`                   // 扩展字段
}

// XiaomiResponse 小米推送API响应结构
// XiaomiResponseData 小米推送响应数据结构
type XiaomiResponseData struct {
	ID       string `json:"id"`        // 消息ID
	DayAcked string `json:"day_acked"` // 当日已确认数量
	DayQuota string `json:"day_quota"` // 当日配额
}

type XiaomiResponse struct {
	Result      string             `json:"result"`      // 响应结果：ok=成功
	TraceID     string             `json:"trace_id"`    // 请求跟踪ID
	Code        int                `json:"code"`        // 错误码：0=成功
	Data        XiaomiResponseData `json:"data"`        // 响应数据
	Description string             `json:"description"` // 错误描述
	Info        string             `json:"info"`        // 附加信息
	Reason      string             `json:"reason"`      // 失败原因（错误时）
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
	case "honor":
		return a.sendHonor(device, pushLog)
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
		return a.createAuthError(pushLog, "FCM", err)
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
		return a.createPayloadError(pushLog, err)
	}

	// 构建 FCM v1 API 请求 URL
	requestURL := fmt.Sprintf("https://fcm.googleapis.com/v1/projects/%s/messages:send", a.config.ProjectID)

	// 创建 HTTP 请求
	req, err := http.NewRequest("POST", requestURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return a.createRequestError(pushLog, err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	// 发送请求
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return a.createNetworkError(pushLog, err)
	}
	defer resp.Body.Close()

	// 读取响应
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return a.createResponseError(pushLog, err)
	}

	// 解析响应状态
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		ResponseData: string(respBody),
	}

	if resp.StatusCode == http.StatusOK {
		result.Success = true
	} else {
		result.Success = false
		// 使用统一错误处理
		a.mapFCMError(result, resp.StatusCode, respBody)
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
		return a.createAuthError(pushLog, "华为", err)
	}

	// 构建推送消息
	message := a.buildHuaweiMessage(device, pushLog)

	// 发送推送
	huaweiCode, huaweiMsg, err := a.sendHuaweiMessage(accessToken, message)
	if err != nil {
		// 检查是否是网络错误
		if huaweiCode == "" {
			return a.createNetworkError(pushLog, err)
		}
		// 使用华为错误映射
		a.mapHuaweiError(result, huaweiCode, huaweiMsg)
		return result
	}

	result.Success = true
	result.ResponseData = `{"message_id":"success"}`

	return result
}

// sendHonor 荣耀推送主函数
func (a *AndroidProvider) sendHonor(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      false,
		ResponseData: "{}",
	}

	// 获取 access token
	accessToken, err := a.getHonorAccessToken()
	if err != nil {
		return a.createAuthError(pushLog, "荣耀", err)
	}

	// 构建推送消息
	message := a.buildHonorMessage(device, pushLog)

	// 发送推送
	honorCode, honorMsg, err := a.sendHonorMessage(accessToken, message)
	if err != nil {
		// 检查是否是网络错误
		if honorCode == 0 {
			return a.createNetworkError(pushLog, err)
		}
		// 使用荣耀错误映射
		a.mapHonorError(result, honorCode, honorMsg)
		return result
	}

	result.Success = true
	result.ResponseData = `{"message_id":"success"}`

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

	// 构建自定义数据字段，包含统一标识字段
	dataMap := make(map[string]interface{})

	// 添加统计标识字段，保持与APNs和FCM一致
	dataMap["badge"] = pushLog.Badge
	dataMap["push_log_id"] = pushLog.ID
	if pushLog.DedupKey != "" {
		dataMap["dedup_key"] = pushLog.DedupKey
	}
	dataMap["dp_source"] = "doopush"

	// 解析并合并自定义数据
	if pushLog.Payload != "" && pushLog.Payload != "{}" {
		var customData map[string]interface{}
		if err := json.Unmarshal([]byte(pushLog.Payload), &customData); err == nil {
			// 合并自定义数据，但不覆盖统一标识字段
			for k, v := range customData {
				if k != "push_log_id" && k != "dp_source" && k != "badge" && k != "huawei" {
					dataMap[k] = v
				}
			}
		}
	}

	// 序列化数据为JSON字符串（华为API要求）
	dataJSON, err := json.Marshal(dataMap)
	if err != nil {
		dataJSON = []byte("{}")
	}

	// 构建Android配置 - 添加必需的ClickAction和华为特有参数
	androidConfig := &HuaweiAndroidConfig{
		Urgency:  "HIGH",
		TTL:      "86400s",
		Category: category,         // 华为自定义分类，避免频控
		Data:     string(dataJSON), // 在Android配置中也设置数据，确保数据传递
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
		Data:         string(dataJSON), // 华为推送的data字段为字符串格式
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

// sendHuaweiMessage 发送华为推送消息，返回华为错误码、错误消息和错误
func (a *AndroidProvider) sendHuaweiMessage(accessToken string, message *HuaweiMessageRequest) (string, string, error) {
	// 华为推送API endpoint
	pushURL := fmt.Sprintf("https://push-api.cloud.huawei.com/v1/%s/messages:send", a.config.AppID)

	// 序列化消息
	messageJSON, err := json.Marshal(message)
	if err != nil {
		return "", "", fmt.Errorf("序列化华为推送消息失败: %v", err)
	}

	// 创建请求
	req, err := http.NewRequest("POST", pushURL, bytes.NewBuffer(messageJSON))
	if err != nil {
		return "", "", fmt.Errorf("创建华为推送请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/json; charset=UTF-8")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))

	// 发送请求
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("华为推送请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", fmt.Errorf("读取华为推送响应失败: %v", err)
	}

	// 解析华为响应
	var huaweiResp HuaweiResponse
	if err := json.Unmarshal(body, &huaweiResp); err != nil {
		return "", "", fmt.Errorf("解析华为推送响应失败: %v, 原始响应: %s", err, string(body))
	}

	// 检查华为的响应码
	if huaweiResp.Code != "80000000" {
		return huaweiResp.Code, huaweiResp.Msg, fmt.Errorf("华为推送失败，错误码: %s, 错误信息: %s", huaweiResp.Code, huaweiResp.Msg)
	}

	return huaweiResp.Code, huaweiResp.Msg, nil
}

// sendHonorMessage 发送荣耀推送消息
func (a *AndroidProvider) sendHonorMessage(accessToken string, message *HonorMessageRequest) (int, string, error) {
	// 荣耀推送API endpoint
	pushURL := fmt.Sprintf("https://push-api.cloud.honor.com/api/v1/%s/sendMessage", a.config.AppID)

	// 序列化消息
	messageJSON, err := json.Marshal(message)
	if err != nil {
		return 0, "", fmt.Errorf("序列化荣耀推送消息失败: %v", err)
	}

	// 创建请求
	req, err := http.NewRequest("POST", pushURL, bytes.NewBuffer(messageJSON))
	if err != nil {
		return 0, "", fmt.Errorf("创建荣耀推送请求失败: %v", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))
	req.Header.Set("timestamp", fmt.Sprintf("%d", time.Now().UnixNano()/int64(time.Millisecond)))

	// 发送请求
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return 0, "", fmt.Errorf("荣耀推送请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, "", fmt.Errorf("读取荣耀推送响应失败: %v", err)
	}

	// 解析荣耀响应
	var honorResp HonorSendResponse
	if err := json.Unmarshal(body, &honorResp); err != nil {
		return 0, "", fmt.Errorf("解析荣耀推送响应失败: %v, 原始响应: %s", err, string(body))
	}

	// 检查荣耀的响应码
	if honorResp.Code != 200 {
		return honorResp.Code, honorResp.Message, fmt.Errorf("荣耀推送失败，错误码: %d, 错误信息: %s", honorResp.Code, honorResp.Message)
	}

	return honorResp.Code, honorResp.Message, nil
}

// buildXiaomiMessage 构建小米推送消息

// getOppoAuthToken 获取OPPO认证token
func (a *AndroidProvider) getOppoAuthToken() (string, error) {
	if a.oppoAuthClient == nil {
		return "", fmt.Errorf("OPPO认证客户端未初始化")
	}

	a.authMutex.Lock()
	defer a.authMutex.Unlock()

	// 检查token是否仍然有效（提前5分钟刷新）
	now := time.Now().UnixNano() / int64(time.Millisecond)
	if a.oppoAuthClient.authToken != "" && a.oppoAuthClient.authTokenExpireAt > now+5*60*1000 {
		return a.oppoAuthClient.authToken, nil
	}

	// 构建认证签名
	timestamp := strconv.FormatInt(time.Now().UnixNano()/1e6, 10)
	signString := a.oppoAuthClient.appKey + timestamp + a.oppoAuthClient.masterSecret
	shaByte := sha256.Sum256([]byte(signString))
	sign := hex.EncodeToString(shaByte[:])

	// 构建认证请求
	authReq := OppoAuthRequest{
		AppKey:    a.oppoAuthClient.appKey,
		Sign:      sign,
		Timestamp: timestamp,
	}

	// 将请求参数转换为form data
	params := url.Values{}
	params.Add("app_key", authReq.AppKey)
	params.Add("sign", authReq.Sign)
	params.Add("timestamp", authReq.Timestamp)

	// 发送认证请求
	authURL := oppoHost + oppoAuthURL
	req, err := http.NewRequest("POST", authURL, strings.NewReader(params.Encode()))
	if err != nil {
		return "", fmt.Errorf("创建OPPO认证请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("OPPO认证请求失败: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取OPPO认证响应失败: %v", err)
	}

	// 解析认证响应
	var authResp OppoAuthResponse
	if err := json.Unmarshal(body, &authResp); err != nil {
		return "", fmt.Errorf("解析OPPO认证响应失败: %v, 原始响应: %s", err, string(body))
	}

	// 检查认证结果
	if resp.StatusCode != http.StatusOK || authResp.Code != 0 || authResp.Data.AuthToken == "" {
		return "", fmt.Errorf("OPPO认证失败: status=%d, code=%d, message=%s, body=%s",
			resp.StatusCode, authResp.Code, authResp.Message, string(body))
	}

	// 保存认证token，设置过期时间为1小时后
	a.oppoAuthClient.authToken = authResp.Data.AuthToken
	a.oppoAuthClient.authTokenExpireAt = now + 60*60*1000

	return a.oppoAuthClient.authToken, nil
}

// getVivoAuthToken 获取VIVO认证token
func (a *AndroidProvider) getVivoAuthToken() (string, error) {
	if a.vivoAuthClient == nil {
		return "", fmt.Errorf("VIVO认证客户端未初始化")
	}

	a.authMutex.Lock()
	defer a.authMutex.Unlock()

	// 检查token是否仍然有效（提前5分钟刷新）
	now := time.Now().UnixNano() / int64(time.Millisecond)
	if a.vivoAuthClient.authToken != "" && a.vivoAuthClient.authTokenExpireAt > now+5*60*1000 {
		return a.vivoAuthClient.authToken, nil
	}

	// 构建认证签名（VIVO使用MD5签名）
	timestamp := now
	signString := a.vivoAuthClient.appID + a.vivoAuthClient.appKey + strconv.FormatInt(timestamp, 10) + a.vivoAuthClient.appSecret
	h := md5.New()
	h.Write([]byte(signString))
	sign := hex.EncodeToString(h.Sum(nil))

	// 构建认证请求
	authReq := VivoAuthRequest{
		AppID:     a.vivoAuthClient.appID,
		AppKey:    a.vivoAuthClient.appKey,
		Timestamp: timestamp,
		Sign:      sign,
	}

	// 将请求参数转换为JSON
	requestJSON, err := json.Marshal(authReq)
	if err != nil {
		return "", fmt.Errorf("序列化VIVO认证请求失败: %v", err)
	}

	// 发送认证请求
	authURL := vivoHost + vivoAuthURL
	req, err := http.NewRequest("POST", authURL, bytes.NewBuffer(requestJSON))
	if err != nil {
		return "", fmt.Errorf("创建VIVO认证请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("VIVO认证请求失败: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取VIVO认证响应失败: %v", err)
	}

	// 解析认证响应
	var authResp VivoAuthResponse
	if err := json.Unmarshal(body, &authResp); err != nil {
		return "", fmt.Errorf("解析VIVO认证响应失败: %v, 原始响应: %s", err, string(body))
	}

	// 检查认证结果（VIVO的成功码是0）
	if resp.StatusCode != http.StatusOK || authResp.Result != 0 || authResp.AuthToken == "" {
		return "", fmt.Errorf("VIVO认证失败: status=%d, result=%d, desc=%s, body=%s",
			resp.StatusCode, authResp.Result, authResp.Desc, string(body))
	}

	// 保存认证token，设置过期时间（VIVO返回的ValidTime是毫秒时间戳）
	a.vivoAuthClient.authToken = authResp.AuthToken
	if authResp.ValidTime > 0 {
		a.vivoAuthClient.authTokenExpireAt = authResp.ValidTime
	} else {
		// 如果没有返回过期时间，默认设置为1小时后
		a.vivoAuthClient.authTokenExpireAt = now + 60*60*1000
	}

	return a.vivoAuthClient.authToken, nil
}

// getHonorAccessToken 获取荣耀认证token
func (a *AndroidProvider) getHonorAccessToken() (string, error) {
	if a.honorAuthClient == nil {
		return "", fmt.Errorf("荣耀认证客户端未初始化")
	}

	a.authMutex.Lock()
	defer a.authMutex.Unlock()

	// 检查token是否仍然有效（提前5分钟刷新）
	now := time.Now().Unix()
	if a.honorAuthClient.accessToken != "" && a.honorAuthClient.tokenExpireAt > now+5*60 {
		return a.honorAuthClient.accessToken, nil
	}

	// 构建认证请求（荣耀使用OAuth 2.0 client_credentials flow）
	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", a.honorAuthClient.clientID)
	data.Set("client_secret", a.honorAuthClient.clientSecret)

	// 发送认证请求
	authURL := "https://iam.developer.honor.com/auth/token"
	req, err := http.NewRequest("POST", authURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("创建荣耀认证请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("荣耀认证请求失败: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取荣耀认证响应失败: %v", err)
	}

	// 解析认证响应
	var authResp HonorAuthResponse
	if err := json.Unmarshal(body, &authResp); err != nil {
		return "", fmt.Errorf("解析荣耀认证响应失败: %v, 原始响应: %s", err, string(body))
	}

	// 检查认证结果
	if resp.StatusCode != http.StatusOK || authResp.AccessToken == "" {
		return "", fmt.Errorf("荣耀认证失败: status=%d, body=%s", resp.StatusCode, string(body))
	}

	// 保存认证token，设置过期时间
	a.honorAuthClient.accessToken = authResp.AccessToken
	if authResp.ExpiresIn > 0 {
		a.honorAuthClient.tokenExpireAt = now + int64(authResp.ExpiresIn)
	} else {
		// 如果没有返回过期时间，默认设置为1小时后
		a.honorAuthClient.tokenExpireAt = now + 3600
	}

	return a.honorAuthClient.accessToken, nil
}

// buildHonorMessage 构建荣耀推送消息
func (a *AndroidProvider) buildHonorMessage(device *models.Device, pushLog *models.PushLog) *HonorMessageRequest {
	// 构建简单的通知内容
	notification := &HonorNotification{
		Title: pushLog.Title,
		Body:  pushLog.Content,
	}

	// 解析荣耀特有参数
	importance := "NORMAL" // 默认为服务通讯类消息
	ttl := "86400s"        // 默认消息存活时间1天
	targetUserType := 0    // 默认为正式消息

	// 从pushLog.Payload中解析荣耀特有参数
	if pushLog.Payload != "" && pushLog.Payload != "{}" {
		var payloadMap map[string]interface{}
		if err := json.Unmarshal([]byte(pushLog.Payload), &payloadMap); err == nil {
			if honorData, ok := payloadMap["honor"].(map[string]interface{}); ok {
				if imp, ok := honorData["importance"].(string); ok && imp != "" {
					importance = imp
				}
				if t, ok := honorData["ttl"].(string); ok && t != "" {
					ttl = t
				}
				if tut, ok := honorData["target_user_type"].(float64); ok {
					targetUserType = int(tut)
				}
			}
		}
	}

	// 构建自定义数据字段，包含统一标识字段
	dataMap := make(map[string]interface{})

	// 添加统计标识字段，保持与APNs和FCM一致
	dataMap["badge"] = pushLog.Badge
	dataMap["push_log_id"] = pushLog.ID
	if pushLog.DedupKey != "" {
		dataMap["dedup_key"] = pushLog.DedupKey
	}
	dataMap["dp_source"] = "doopush"

	// 解析并合并自定义数据
	if pushLog.Payload != "" && pushLog.Payload != "{}" {
		var customData map[string]interface{}
		if err := json.Unmarshal([]byte(pushLog.Payload), &customData); err == nil {
			// 合并自定义数据，但不覆盖统一标识字段
			for k, v := range customData {
				if k != "push_log_id" && k != "dp_source" && k != "badge" && k != "honor" {
					dataMap[k] = v
				}
			}
		}
	}

	// 序列化数据为JSON字符串
	dataJSON, err := json.Marshal(dataMap)
	if err != nil {
		dataJSON = []byte("{}")
	}

	// 构建Android配置
	androidConfig := &HonorAndroidConfig{
		TTL:            ttl,
		Data:           string(dataJSON),
		TargetUserType: targetUserType,
		Notification: &HonorAndroidNotification{
			Title:      pushLog.Title,
			Body:       pushLog.Content,
			Importance: importance,
			// 荣耀推送要求通知消息必须包含ClickAction
			ClickAction: &HonorClickAction{
				Type: 3, // 3=打开应用
			},
			// 荣耀角标支持 - 设置角标数量（仅在角标>=0时设置）
			Badge: func() *HonorBadgeNotification {
				if pushLog.Badge >= 0 {
					return &HonorBadgeNotification{
						SetNum:     pushLog.Badge, // 设置角标数量
						BadgeClass: "",            // 应用入口Activity类，留空使用默认
					}
				}
				return nil // 角标<0时不设置
			}(),
		},
	}

	// 构建消息体
	message := &HonorMessageRequest{
		Notification: notification,
		Android:      androidConfig,
		Token:        []string{device.Token},
		Data:         string(dataJSON),
	}

	return message
}

// buildOppoMessage 构建OPPO推送消息
func (a *AndroidProvider) buildOppoMessage(device *models.Device, pushLog *models.PushLog) *OppoMessage {
	// 解析OPPO特有参数
	category := ""      // OPPO消息分类
	notifyLevel := 2    // OPPO提醒等级，默认为2（通知栏+锁屏）
	channelID := ""     // 通道ID
	offLine := true     // 默认启用离线消息
	offLineTTL := 86400 // 默认离线消息存活24小时

	// 构建自定义数据用于action_parameters
	customData := make(map[string]interface{})
	customData["badge"] = pushLog.Badge
	customData["push_log_id"] = pushLog.ID
	if pushLog.DedupKey != "" {
		customData["dedup_key"] = pushLog.DedupKey
	}
	customData["dp_source"] = "doopush"

	// 从pushLog.Payload中解析OPPO特有参数和自定义数据
	if pushLog.Payload != "" && pushLog.Payload != "{}" {
		var payloadMap map[string]interface{}
		if err := json.Unmarshal([]byte(pushLog.Payload), &payloadMap); err == nil {
			// 解析OPPO特有参数
			if oppoData, ok := payloadMap["oppo"].(map[string]interface{}); ok {
				if categoryStr, ok := oppoData["category"].(string); ok && categoryStr != "" {
					category = categoryStr
				}
				if notifyLevelFloat, ok := oppoData["notify_level"].(float64); ok {
					notifyLevel = int(notifyLevelFloat)
				}
				if channelIDStr, ok := oppoData["channel_id"].(string); ok && channelIDStr != "" {
					channelID = channelIDStr
				}
				if offLineBool, ok := oppoData["off_line"].(bool); ok {
					offLine = offLineBool
				}
				if offLineTTLFloat, ok := oppoData["off_line_ttl"].(float64); ok {
					offLineTTL = int(offLineTTLFloat)
				}
			}

			// 合并其他自定义数据
			for k, v := range payloadMap {
				if k != "push_log_id" && k != "dp_source" && k != "badge" && k != "oppo" && k != "dedup_key" {
					customData[k] = v
				}
			}
		}
	}

	// 将自定义数据序列化为JSON字符串，用于action_parameters
	actionParameters := ""
	if len(customData) > 0 {
		if paramsJSON, err := json.Marshal(customData); err == nil {
			actionParameters = string(paramsJSON)
		}
	}

	// 构建OPPO通知消息
	notification := &OppoNotification{
		AppMessageID:     fmt.Sprintf("dp_%d_%d", pushLog.ID, time.Now().Unix()), // 使用推送日志ID和时间戳作为消息去重ID
		Style:            1,                                                      // 标准样式
		Title:            pushLog.Title,
		Content:          pushLog.Content,
		ClickActionType:  0,                // 启动应用
		ActionParameters: actionParameters, // 自定义数据作为跳转参数
		OffLine:          offLine,
		OffLineTTL:       offLineTTL,
		ChannelID:        channelID,
		Category:         category,
		NotifyLevel:      notifyLevel,
	}

	// 构建OPPO推送消息
	message := &OppoMessage{
		TargetType:           2,            // 2 = registration_id
		TargetValue:          device.Token, // 设备Token
		Notification:         notification,
		VerifyRegistrationId: false, // 不验证registration_id，提高成功率
	}

	return message
}

// buildVivoMessage 构建VIVO推送消息
func (a *AndroidProvider) buildVivoMessage(device *models.Device, pushLog *models.PushLog) *VivoMessage {
	// 解析VIVO特有参数
	notifyType := 1     // 通知类型，默认为1（通知栏）
	timeToLive := 86400 // 离线保存时长，默认24小时（秒）
	skipType := 1       // 跳转类型，默认为1（打开应用）
	skipContent := ""   // 跳转内容
	networkType := -1   // 网络类型，默认为-1（不限制）
	classification := 0 // 消息分类，默认为0（运营消息）

	// 构建自定义数据
	customData := make(map[string]string)
	customData["badge"] = fmt.Sprintf("%d", pushLog.Badge)
	customData["push_log_id"] = fmt.Sprintf("%d", pushLog.ID)
	if pushLog.DedupKey != "" {
		customData["dedup_key"] = pushLog.DedupKey
	}
	customData["dp_source"] = "doopush"

	// 从pushLog.Payload中解析VIVO特有参数和自定义数据
	if pushLog.Payload != "" && pushLog.Payload != "{}" {
		var payloadMap map[string]interface{}
		if err := json.Unmarshal([]byte(pushLog.Payload), &payloadMap); err == nil {
			// 解析VIVO特有参数
			if vivoData, ok := payloadMap["vivo"].(map[string]interface{}); ok {
				if classificationFloat, ok := vivoData["classification"].(float64); ok {
					classification = int(classificationFloat)
				}
				if notifyTypeFloat, ok := vivoData["notify_type"].(float64); ok {
					notifyType = int(notifyTypeFloat)
				}
				if skipTypeFloat, ok := vivoData["skip_type"].(float64); ok {
					skipType = int(skipTypeFloat)
				}
				if skipContentStr, ok := vivoData["skip_content"].(string); ok && skipContentStr != "" {
					skipContent = skipContentStr
				}
				if networkTypeFloat, ok := vivoData["network_type"].(float64); ok {
					networkType = int(networkTypeFloat)
				}
				if timeToLiveFloat, ok := vivoData["time_to_live"].(float64); ok {
					timeToLive = int(timeToLiveFloat)
				}
				if clientCustomMapData, ok := vivoData["client_custom_map"].(map[string]interface{}); ok {
					for k, v := range clientCustomMapData {
						if strValue := fmt.Sprintf("%v", v); strValue != "" {
							customData[k] = strValue
						}
					}
				}
			}

			// 合并其他自定义数据，但不覆盖统一标识字段和VIVO特有字段
			for k, v := range payloadMap {
				if k != "push_log_id" && k != "dp_source" && k != "badge" && k != "vivo" {
					if strValue := fmt.Sprintf("%v", v); strValue != "" {
						customData[k] = strValue
					}
				}
			}
		}
	}

	// 构建VIVO推送消息
	message := &VivoMessage{
		RegID:           device.Token,
		Title:           pushLog.Title,
		Content:         pushLog.Content,
		NotifyType:      notifyType,
		TimeToLive:      timeToLive,
		SkipType:        skipType,
		SkipContent:     skipContent,
		NetworkType:     networkType,
		Classification:  classification,
		RequestID:       fmt.Sprintf("dp_%d_%d", pushLog.ID, time.Now().Unix()), // 使用推送日志ID和时间戳作为请求ID
		ClientCustomMap: customData,
	}

	return message
}

func (a *AndroidProvider) buildXiaomiMessage(device *models.Device, pushLog *models.PushLog) *XiaomiMessage {
	// 构建基本消息结构
	message := &XiaomiMessage{
		Title:                 pushLog.Title,
		Description:           pushLog.Content,
		PassThrough:           0,                         // 0=通知消息，1=透传消息
		NotifyType:            7,                         // 1=声音，2=震动，4=指示灯，7=全部
		TimeToLive:            86400000,                  // 消息存活时间24小时(ms)
		NotifyID:              int(pushLog.ID % 1000000), // 使用推送日志ID作为通知ID，取模避免过大
		RestrictedPackageName: device.App.PackageName,    // 应用包名，小米推送必需参数
		Extra:                 make(map[string]interface{}),
	}

	// 解析小米特有参数
	passThrough := 0
	notifyType := 7
	timeToLive := int64(86400000)
	channelID := ""

	// 从pushLog.Payload中解析小米特有参数
	if pushLog.Payload != "" && pushLog.Payload != "{}" {
		var payloadMap map[string]interface{}
		if err := json.Unmarshal([]byte(pushLog.Payload), &payloadMap); err == nil {
			if xiData, ok := payloadMap["xiaomi"].(map[string]interface{}); ok {
				if pt, ok := xiData["pass_through"].(float64); ok {
					passThrough = int(pt)
				}
				if nt, ok := xiData["notify_type"].(float64); ok {
					notifyType = int(nt)
				}
				if ttl, ok := xiData["time_to_live"].(float64); ok {
					timeToLive = int64(ttl)
				}
				if ch, ok := xiData["channel_id"].(string); ok && ch != "" {
					channelID = ch
				}
			}
		}
	}

	message.PassThrough = passThrough
	message.NotifyType = notifyType
	message.TimeToLive = timeToLive
	message.ChannelID = channelID

	// 构建扩展数据字段，包含统一标识字段
	extraMap := make(map[string]interface{})

	// 添加统计标识字段，保持与APNs、FCM和华为推送一致
	extraMap["badge"] = pushLog.Badge
	extraMap["push_log_id"] = pushLog.ID
	if pushLog.DedupKey != "" {
		extraMap["dedup_key"] = pushLog.DedupKey
	}
	extraMap["dp_source"] = "doopush"

	// 解析并合并自定义数据到extra字段
	if pushLog.Payload != "" && pushLog.Payload != "{}" {
		var customData map[string]interface{}
		if err := json.Unmarshal([]byte(pushLog.Payload), &customData); err == nil {
			// 合并自定义数据，但不覆盖统一标识字段和小米特有字段
			for k, v := range customData {
				if k != "push_log_id" && k != "dp_source" && k != "badge" && k != "xiaomi" {
					extraMap[k] = v
				}
			}
		}
	}

	message.Extra = extraMap

	// 构建payload字段（小米推送的自定义数据载荷）
	if len(extraMap) > 0 {
		if payloadJSON, err := json.Marshal(extraMap); err == nil {
			message.Payload = string(payloadJSON)
		}
	}

	return message
}

// sendXiaomiMessage 发送小米推送消息，返回小米错误码、错误消息、消息ID和错误
func (a *AndroidProvider) sendXiaomiMessage(message *XiaomiMessage, device *models.Device) (string, string, string, error) {
	// 小米推送API endpoint - 向regid推送消息
	pushURL := "https://api.xmpush.xiaomi.com/v3/message/regid"

	// 构建请求参数
	data := url.Values{}

	// 添加基本参数
	data.Set("registration_id", device.Token) // 目标设备Token
	data.Set("title", message.Title)
	data.Set("description", message.Description)
	data.Set("payload", message.Payload)
	data.Set("notify_type", fmt.Sprintf("%d", message.NotifyType))
	data.Set("time_to_live", fmt.Sprintf("%d", message.TimeToLive))
	data.Set("pass_through", fmt.Sprintf("%d", message.PassThrough))
	data.Set("restricted_package_name", message.RestrictedPackageName) // 应用包名，小米推送必需参数

	if message.NotifyID > 0 {
		data.Set("notify_id", fmt.Sprintf("%d", message.NotifyID))
	}

	// 添加通道ID（如果配置了）
	if message.ChannelID != "" {
		data.Set("channel_id", message.ChannelID)
	}

	// 添加扩展数据
	if len(message.Extra) > 0 {
		for key, value := range message.Extra {
			if strValue, ok := value.(string); ok {
				data.Set("extra."+key, strValue)
			} else {
				data.Set("extra."+key, fmt.Sprintf("%v", value))
			}
		}
	}

	// 创建HTTP请求
	req, err := http.NewRequest("POST", pushURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", "", "", fmt.Errorf("创建小米推送请求失败: %v", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", fmt.Sprintf("key=%s", a.config.AppSecret)) // 小米推送使用App Secret作为认证

	// 发送请求
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", "", "", fmt.Errorf("小米推送请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", fmt.Errorf("读取小米推送响应失败: %v", err)
	}

	// 解析小米响应
	var xiaomiResp XiaomiResponse
	if err := json.Unmarshal(body, &xiaomiResp); err != nil {
		return "", "", "", fmt.Errorf("解析小米推送响应失败: %v, 原始响应: %s", err, string(body))
	}

	// 检查小米的响应结果
	if xiaomiResp.Result != "ok" {
		errorMsg := xiaomiResp.Description
		if errorMsg == "" {
			errorMsg = xiaomiResp.Reason
		}
		if errorMsg == "" {
			errorMsg = xiaomiResp.Info
		}
		if errorMsg == "" {
			errorMsg = "未知错误"
		}
		return xiaomiResp.Result, errorMsg, "", fmt.Errorf("小米推送失败，结果: %s, 错误码: %d, 错误信息: %s",
			xiaomiResp.Result, xiaomiResp.Code, errorMsg)
	}

	// 成功时返回消息ID
	messageID := xiaomiResp.Data.ID
	if messageID == "" {
		messageID = "unknown"
	}

	return xiaomiResp.Result, "", messageID, nil
}

// sendOppoMessage 发送OPPO推送消息，返回OPPO错误码、错误消息、消息ID和错误
func (a *AndroidProvider) sendOppoMessage(message *OppoMessage, device *models.Device) (string, string, string, error) {
	// 获取认证token
	authToken, err := a.getOppoAuthToken()
	if err != nil {
		return "", "", "", fmt.Errorf("获取OPPO认证token失败: %v", err)
	}

	// 序列化消息为JSON
	messageJSON, err := json.Marshal(message)
	if err != nil {
		return "", "", "", fmt.Errorf("序列化OPPO推送消息失败: %v", err)
	}

	// 构建推送API URL
	pushURL := oppoHost + oppoSendURL

	// 构建form data参数
	params := url.Values{}
	params.Add("message", string(messageJSON))
	params.Add("auth_token", authToken)

	// 创建HTTP请求
	req, err := http.NewRequest("POST", pushURL, strings.NewReader(params.Encode()))
	if err != nil {
		return "", "", "", fmt.Errorf("创建OPPO推送请求失败: %v", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// 发送请求
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", "", "", fmt.Errorf("OPPO推送请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", fmt.Errorf("读取OPPO推送响应失败: %v", err)
	}

	// 解析OPPO响应
	var oppoResp OppoSendResponse
	if err := json.Unmarshal(body, &oppoResp); err != nil {
		return "", "", "", fmt.Errorf("解析OPPO推送响应失败: %v, 原始响应: %s", err, string(body))
	}

	// 检查OPPO的响应结果
	if resp.StatusCode != http.StatusOK || oppoResp.Code != 0 {
		errorMsg := oppoResp.Message
		if errorMsg == "" {
			errorMsg = "未知错误"
		}
		return fmt.Sprintf("%d", oppoResp.Code), errorMsg, "", fmt.Errorf("OPPO推送失败: status=%d, code=%d, message=%s, body=%s",
			resp.StatusCode, oppoResp.Code, errorMsg, string(body))
	}

	// 成功时返回消息ID
	messageID := oppoResp.Data.MessageID
	if messageID == "" {
		messageID = "unknown"
	}

	return "0", "", messageID, nil
}

// sendVivoMessage 发送VIVO推送消息，返回VIVO错误码、错误消息、任务ID和错误
func (a *AndroidProvider) sendVivoMessage(message *VivoMessage, device *models.Device) (string, string, string, error) {
	// 获取认证token
	authToken, err := a.getVivoAuthToken()
	if err != nil {
		return "", "", "", fmt.Errorf("获取VIVO认证token失败: %v", err)
	}

	// 构建请求参数
	requestData := make(map[string]interface{})
	// 将VivoMessage的字段直接作为请求参数
	requestData["regId"] = message.RegID
	requestData["title"] = message.Title
	requestData["content"] = message.Content
	requestData["notifyType"] = message.NotifyType
	requestData["timeToLive"] = message.TimeToLive
	requestData["skipType"] = message.SkipType
	if message.SkipContent != "" {
		requestData["skipContent"] = message.SkipContent
	}
	requestData["networkType"] = message.NetworkType
	requestData["classification"] = message.Classification
	requestData["requestId"] = message.RequestID
	if len(message.ClientCustomMap) > 0 {
		requestData["clientCustomMap"] = message.ClientCustomMap
	}

	// 序列化请求数据为JSON
	requestJSON, err := json.Marshal(requestData)
	if err != nil {
		return "", "", "", fmt.Errorf("序列化VIVO推送请求失败: %v", err)
	}

	// 构建推送API URL
	pushURL := vivoHost + vivoSendURL

	// 创建HTTP请求
	req, err := http.NewRequest("POST", pushURL, bytes.NewBuffer(requestJSON))
	if err != nil {
		return "", "", "", fmt.Errorf("创建VIVO推送请求失败: %v", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("authToken", authToken)

	// 发送请求
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", "", "", fmt.Errorf("VIVO推送请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", fmt.Errorf("读取VIVO推送响应失败: %v", err)
	}

	// 解析VIVO响应
	var vivoResp VivoSendResponse
	if err := json.Unmarshal(body, &vivoResp); err != nil {
		return "", "", "", fmt.Errorf("解析VIVO推送响应失败: %v, 原始响应: %s", err, string(body))
	}

	// 检查VIVO的响应结果（VIVO的成功码是0）
	if resp.StatusCode != http.StatusOK || vivoResp.Result != 0 {
		errorMsg := vivoResp.Desc
		if errorMsg == "" {
			errorMsg = "未知错误"
		}
		return fmt.Sprintf("%d", vivoResp.Result), errorMsg, "", fmt.Errorf("VIVO推送失败: status=%d, result=%d, desc=%s, body=%s",
			resp.StatusCode, vivoResp.Result, errorMsg, string(body))
	}

	// 成功时返回任务ID
	taskID := vivoResp.TaskID
	if taskID == "" {
		taskID = "unknown"
	}

	return "0", "", taskID, nil
}

// mapVivoError 映射VIVO错误到统一错误码
func (a *AndroidProvider) mapVivoError(result *models.PushResult, vivoResult string, vivoMsg string) {
	resultCode := vivoResult
	if resultCode == "0" {
		// 成功，不应该调用此函数
		result.Success = true
		return
	}

	// 将字符串转换为数字进行映射
	switch resultCode {
	case "10004", "10101", "10102", "10103":
		// 参数错误类
		result.ErrorCode = "INVALID_PARAMETER"
		result.ErrorMessage = fmt.Sprintf("参数错误: %s", vivoMsg)
	case "10301", "10302":
		// 认证错误类
		result.ErrorCode = "AUTHENTICATION_ERROR"
		result.ErrorMessage = fmt.Sprintf("认证失败: %s", vivoMsg)
	case "30001":
		// Token无效
		result.ErrorCode = "INVALID_TOKEN"
		result.ErrorMessage = fmt.Sprintf("设备Token无效: %s", vivoMsg)
	case "30002":
		// 应用未找到
		result.ErrorCode = "INVALID_APPLICATION"
		result.ErrorMessage = fmt.Sprintf("应用未找到: %s", vivoMsg)
	case "40000", "40001", "40002":
		// 服务器错误类
		result.ErrorCode = "SERVER_ERROR"
		result.ErrorMessage = fmt.Sprintf("VIVO服务器错误: %s", vivoMsg)
	case "50000", "50001":
		// 限流错误类
		result.ErrorCode = "RATE_LIMIT_EXCEEDED"
		result.ErrorMessage = fmt.Sprintf("推送频率过高: %s", vivoMsg)
	default:
		// 未知错误
		result.ErrorCode = "UNKNOWN_ERROR"
		if vivoMsg != "" {
			result.ErrorMessage = fmt.Sprintf("VIVO推送失败: 错误码=%s, 错误信息=%s", resultCode, vivoMsg)
		} else {
			result.ErrorMessage = fmt.Sprintf("VIVO推送失败: 错误码=%s", resultCode)
		}
	}
}

// mapXiaomiError 映射小米错误到统一错误码
func (a *AndroidProvider) mapXiaomiError(result *models.PushResult, xiaomiResult string, xiaomiMsg string) {
	switch xiaomiResult {
	case "ok":
		// 成功，不应该调用此函数
		result.Success = true
		return
	case "InvalidAppSecret":
		result.ErrorCode = "AUTHENTICATION_ERROR"
		result.ErrorMessage = "小米认证失败，请检查AppSecret"
	case "InvalidRegistrationId":
		result.ErrorCode = "INVALID_TOKEN"
		result.ErrorMessage = "小米设备注册ID无效：" + xiaomiMsg
	case "MismatchedSender":
		result.ErrorCode = "AUTHENTICATION_ERROR"
		result.ErrorMessage = "小米发送者不匹配，请检查应用配置"
	case "MessageTooBig":
		result.ErrorCode = "PAYLOAD_TOO_LARGE"
		result.ErrorMessage = "小米推送消息过大：" + xiaomiMsg
	case "MissingRegistration":
		result.ErrorCode = "INVALID_TOKEN"
		result.ErrorMessage = "小米设备注册ID缺失"
	case "InvalidPackageName":
		result.ErrorCode = "INVALID_ARGUMENT"
		result.ErrorMessage = "小米应用包名无效：" + xiaomiMsg
	case "QuotaExceeded":
		result.ErrorCode = "QUOTA_EXCEEDED"
		result.ErrorMessage = "小米推送配额超限：" + xiaomiMsg
	case "DeviceQuotaExceeded":
		result.ErrorCode = "QUOTA_EXCEEDED"
		result.ErrorMessage = "小米设备配额超限：" + xiaomiMsg
	case "NotRegistered":
		result.ErrorCode = "INVALID_TOKEN"
		result.ErrorMessage = "小米设备未注册：" + xiaomiMsg
	case "InvalidTitle":
		result.ErrorCode = "INVALID_ARGUMENT"
		result.ErrorMessage = "小米推送标题无效：" + xiaomiMsg
	case "InvalidDescription":
		result.ErrorCode = "INVALID_ARGUMENT"
		result.ErrorMessage = "小米推送内容无效：" + xiaomiMsg
	case "InvalidPayload":
		result.ErrorCode = "INVALID_ARGUMENT"
		result.ErrorMessage = "小米推送载荷无效：" + xiaomiMsg
	case "InvalidTimeToLive":
		result.ErrorCode = "INVALID_ARGUMENT"
		result.ErrorMessage = "小米消息存活时间无效：" + xiaomiMsg
	case "InternalServerError":
		result.ErrorCode = "SERVER_ERROR"
		result.ErrorMessage = "小米推送服务器内部错误：" + xiaomiMsg
	case "ServerUnavailable":
		result.ErrorCode = "SERVER_ERROR"
		result.ErrorMessage = "小米推送服务器不可用：" + xiaomiMsg
	case "Timeout":
		result.ErrorCode = "TIMEOUT"
		result.ErrorMessage = "小米推送请求超时：" + xiaomiMsg
	case "InvalidUserAccount":
		result.ErrorCode = "AUTHENTICATION_ERROR"
		result.ErrorMessage = "小米用户账号无效：" + xiaomiMsg
	case "ForbiddenByUser":
		result.ErrorCode = "PERMISSION_DENIED"
		result.ErrorMessage = "小米用户禁止推送：" + xiaomiMsg
	case "TargetDisabled":
		result.ErrorCode = "TARGET_DISABLED"
		result.ErrorMessage = "小米推送目标已禁用：" + xiaomiMsg
	case "RestrictedPackageName":
		result.ErrorCode = "PERMISSION_DENIED"
		result.ErrorMessage = "小米应用包名受限：" + xiaomiMsg
	case "InvalidSignature":
		result.ErrorCode = "AUTHENTICATION_ERROR"
		result.ErrorMessage = "小米推送签名无效：" + xiaomiMsg
	default:
		result.ErrorCode = "UNKNOWN_ERROR"
		if xiaomiMsg != "" {
			result.ErrorMessage = fmt.Sprintf("小米推送未知错误 (%s): %s", xiaomiResult, xiaomiMsg)
		} else {
			result.ErrorMessage = fmt.Sprintf("小米推送未知错误: %s", xiaomiResult)
		}
	}
}

// sendXiaomi 发送小米推送
func (a *AndroidProvider) sendXiaomi(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      false,
		ResponseData: "{}",
	}

	// 构建小米推送消息
	message := a.buildXiaomiMessage(device, pushLog)

	// 发送推送消息
	xiaomiResult, xiaomiMsg, messageID, err := a.sendXiaomiMessage(message, device)
	if err != nil {
		// 检查是否是网络错误
		if xiaomiResult == "" {
			return a.createNetworkError(pushLog, err)
		}
		// 使用小米错误映射
		a.mapXiaomiError(result, xiaomiResult, xiaomiMsg)
		return result
	}

	result.Success = true
	result.ResponseData = fmt.Sprintf(`{"message_id":"%s"}`, messageID)

	return result
}

// sendOPPO 发送OPPO推送
func (a *AndroidProvider) sendOPPO(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      false,
		ResponseData: "{}",
	}

	// 构建OPPO推送消息
	message := a.buildOppoMessage(device, pushLog)

	// 发送推送消息
	oppoResult, oppoMsg, messageID, err := a.sendOppoMessage(message, device)
	if err != nil {
		// 检查是否是网络错误
		if oppoResult == "" {
			return a.createNetworkError(pushLog, err)
		}
		// 使用OPPO错误映射
		a.mapOppoError(result, oppoResult, oppoMsg)
		return result
	}

	result.Success = true
	result.ResponseData = fmt.Sprintf(`{"message_id":"%s"}`, messageID)

	return result
}

// sendVIVO 发送VIVO推送
func (a *AndroidProvider) sendVIVO(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      false,
		ResponseData: "{}",
	}

	// 构建VIVO推送消息
	message := a.buildVivoMessage(device, pushLog)

	// 发送推送消息
	vivoResult, vivoMsg, taskID, err := a.sendVivoMessage(message, device)
	if err != nil {
		// 检查是否是网络错误
		if vivoResult == "" {
			return a.createNetworkError(pushLog, err)
		}
		// 使用VIVO错误映射
		a.mapVivoError(result, vivoResult, vivoMsg)
		return result
	}

	result.Success = true
	result.ResponseData = fmt.Sprintf(`{"task_id":"%s"}`, taskID)

	return result
}

// 统一错误处理和错误码映射

// mapFCMError 映射FCM错误到统一错误码
func (a *AndroidProvider) mapFCMError(result *models.PushResult, statusCode int, respBody []byte) {
	// 先尝试解析 FCM 错误响应
	var fcmError struct {
		Error struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
			Status  string `json:"status"`
			Details []struct {
				Type        string `json:"@type"`
				ErrorCode   string `json:"errorCode"`
				MessageType string `json:"messageType,omitempty"`
			} `json:"details,omitempty"`
		} `json:"error"`
	}

	// HTTP状态码错误映射
	switch statusCode {
	case 400:
		result.ErrorCode = "INVALID_ARGUMENT"
		result.ErrorMessage = "请求参数无效"
	case 401:
		result.ErrorCode = "AUTHENTICATION_ERROR"
		result.ErrorMessage = "认证失败，请检查服务账号密钥"
	case 403:
		result.ErrorCode = "PERMISSION_DENIED"
		result.ErrorMessage = "权限不足或项目配置错误"
	case 404:
		result.ErrorCode = "NOT_FOUND"
		result.ErrorMessage = "API端点不存在或项目ID错误"
	case 429:
		result.ErrorCode = "QUOTA_EXCEEDED"
		result.ErrorMessage = "发送频率超限，请稍后重试"
	case 500, 502, 503, 504:
		result.ErrorCode = "SERVER_ERROR"
		result.ErrorMessage = "FCM服务器暂时不可用，请稍后重试"
	default:
		result.ErrorCode = fmt.Sprintf("HTTP_%d", statusCode)
		result.ErrorMessage = fmt.Sprintf("FCM 推送失败，HTTP 状态码: %d", statusCode)
	}

	// 尝试解析详细错误信息
	if err := json.Unmarshal(respBody, &fcmError); err == nil && fcmError.Error.Message != "" {
		// FCM特定错误状态码映射
		if fcmError.Error.Status != "" {
			switch fcmError.Error.Status {
			case "INVALID_ARGUMENT":
				result.ErrorCode = "INVALID_ARGUMENT"
				result.ErrorMessage = "请求参数无效：" + fcmError.Error.Message
			case "PERMISSION_DENIED":
				result.ErrorCode = "PERMISSION_DENIED"
				result.ErrorMessage = "权限不足：" + fcmError.Error.Message
			case "NOT_FOUND":
				result.ErrorCode = "NOT_FOUND"
				result.ErrorMessage = "资源不存在：" + fcmError.Error.Message
			case "RESOURCE_EXHAUSTED":
				result.ErrorCode = "QUOTA_EXCEEDED"
				result.ErrorMessage = "资源耗尽：" + fcmError.Error.Message
			case "UNAUTHENTICATED":
				result.ErrorCode = "AUTHENTICATION_ERROR"
				result.ErrorMessage = "认证失败：" + fcmError.Error.Message
			case "UNAVAILABLE":
				result.ErrorCode = "SERVER_ERROR"
				result.ErrorMessage = "服务不可用：" + fcmError.Error.Message
			case "INTERNAL":
				result.ErrorCode = "SERVER_ERROR"
				result.ErrorMessage = "内部服务器错误：" + fcmError.Error.Message
			default:
				result.ErrorCode = fcmError.Error.Status
				result.ErrorMessage = fcmError.Error.Message
			}
		}

		// 检查详细错误码
		if len(fcmError.Error.Details) > 0 {
			for _, detail := range fcmError.Error.Details {
				switch detail.ErrorCode {
				case "UNREGISTERED":
					result.ErrorCode = "INVALID_TOKEN"
					result.ErrorMessage = "设备token已失效，请重新注册"
				case "INVALID_REGISTRATION":
					result.ErrorCode = "INVALID_TOKEN"
					result.ErrorMessage = "设备token格式无效"
				case "SENDER_ID_MISMATCH":
					result.ErrorCode = "SENDER_MISMATCH"
					result.ErrorMessage = "发送方ID不匹配"
				case "MESSAGE_TOO_BIG":
					result.ErrorCode = "PAYLOAD_TOO_LARGE"
					result.ErrorMessage = "消息载荷过大"
				case "INVALID_DATA_KEY":
					result.ErrorCode = "INVALID_DATA_KEY"
					result.ErrorMessage = "数据键无效"
				case "INVALID_TTL":
					result.ErrorCode = "INVALID_TTL"
					result.ErrorMessage = "TTL设置无效"
				case "UNAVAILABLE":
					result.ErrorCode = "SERVER_ERROR"
					result.ErrorMessage = "FCM服务暂时不可用"
				case "INTERNAL":
					result.ErrorCode = "SERVER_ERROR"
					result.ErrorMessage = "FCM内部错误"
				}
			}
		}
	}
}

// mapHuaweiError 映射华为错误到统一错误码
func (a *AndroidProvider) mapHuaweiError(result *models.PushResult, huaweiCode string, huaweiMsg string) {
	switch huaweiCode {
	case "80000000":
		// 成功，不应该调用此函数
		result.Success = true
		return
	case "80100000":
		result.ErrorCode = "AUTHENTICATION_ERROR"
		result.ErrorMessage = "华为认证失败，请检查AppId和AppSecret"
	case "80100001":
		result.ErrorCode = "INVALID_ARGUMENT"
		result.ErrorMessage = "华为推送参数错误：" + huaweiMsg
	case "80100002":
		result.ErrorCode = "INVALID_TOKEN"
		result.ErrorMessage = "华为设备token无效：" + huaweiMsg
	case "80100003":
		result.ErrorCode = "QUOTA_EXCEEDED"
		result.ErrorMessage = "华为推送频率超限：" + huaweiMsg
	case "80100013":
		result.ErrorCode = "PERMISSION_DENIED"
		result.ErrorMessage = "华为推送权限不足：" + huaweiMsg
	case "80200001":
		result.ErrorCode = "SERVER_ERROR"
		result.ErrorMessage = "华为推送服务器错误：" + huaweiMsg
	case "80200003":
		result.ErrorCode = "SERVER_ERROR"
		result.ErrorMessage = "华为推送服务暂时不可用：" + huaweiMsg
	case "80300002":
		result.ErrorCode = "INVALID_TOKEN"
		result.ErrorMessage = "华为设备token已失效：" + huaweiMsg
	case "80300007":
		result.ErrorCode = "PAYLOAD_TOO_LARGE"
		result.ErrorMessage = "华为推送消息过大：" + huaweiMsg
	case "80300008":
		result.ErrorCode = "INVALID_TTL"
		result.ErrorMessage = "华为推送TTL设置无效：" + huaweiMsg
	case "80300010":
		result.ErrorCode = "QUOTA_EXCEEDED"
		result.ErrorMessage = "华为推送次数超限：" + huaweiMsg
	default:
		result.ErrorCode = "HUAWEI_ERROR_" + huaweiCode
		result.ErrorMessage = fmt.Sprintf("华为推送失败，错误码: %s, 错误信息: %s", huaweiCode, huaweiMsg)
	}
}

// mapHonorError 映射荣耀错误到统一错误码
func (a *AndroidProvider) mapHonorError(result *models.PushResult, honorCode int, honorMsg string) {
	switch honorCode {
	case 200:
		// 成功，不应该调用此函数
		result.Success = true
		return
	case 400:
		result.ErrorCode = "INVALID_ARGUMENT"
		result.ErrorMessage = "荣耀推送参数错误：" + honorMsg
	case 401:
		result.ErrorCode = "AUTHENTICATION_ERROR"
		result.ErrorMessage = "荣耀认证失败，请检查client_id和client_secret：" + honorMsg
	case 403:
		result.ErrorCode = "PERMISSION_DENIED"
		result.ErrorMessage = "荣耀推送权限不足：" + honorMsg
	case 404:
		result.ErrorCode = "INVALID_TOKEN"
		result.ErrorMessage = "荣耀设备token无效：" + honorMsg
	case 429:
		result.ErrorCode = "QUOTA_EXCEEDED"
		result.ErrorMessage = "荣耀推送频率超限：" + honorMsg
	case 500:
		result.ErrorCode = "SERVER_ERROR"
		result.ErrorMessage = "荣耀推送服务器内部错误：" + honorMsg
	case 502:
		result.ErrorCode = "SERVER_ERROR"
		result.ErrorMessage = "荣耀推送服务器网关错误：" + honorMsg
	case 503:
		result.ErrorCode = "SERVER_ERROR"
		result.ErrorMessage = "荣耀推送服务暂时不可用：" + honorMsg
	case 504:
		result.ErrorCode = "SERVER_ERROR"
		result.ErrorMessage = "荣耀推送服务器网关超时：" + honorMsg
	default:
		result.ErrorCode = fmt.Sprintf("HONOR_ERROR_%d", honorCode)
		result.ErrorMessage = fmt.Sprintf("荣耀推送失败，错误码: %d, 错误信息: %s", honorCode, honorMsg)
	}
}

// mapOppoError 映射OPPO错误到统一错误码
func (a *AndroidProvider) mapOppoError(result *models.PushResult, oppoCode string, oppoMsg string) {
	switch oppoCode {
	case "0":
		// 成功，不应该调用此函数
		result.Success = true
		return
	case "10000":
		result.ErrorCode = "INVALID_ARGUMENT"
		result.ErrorMessage = "OPPO推送参数无效：" + oppoMsg
	case "10001":
		result.ErrorCode = "AUTHENTICATION_ERROR"
		result.ErrorMessage = "OPPO推送认证失败：" + oppoMsg
	case "10002":
		result.ErrorCode = "PERMISSION_DENIED"
		result.ErrorMessage = "OPPO推送权限不足：" + oppoMsg
	case "10003":
		result.ErrorCode = "QUOTA_EXCEEDED"
		result.ErrorMessage = "OPPO推送频率超限：" + oppoMsg
	case "10004":
		result.ErrorCode = "INVALID_TOKEN"
		result.ErrorMessage = "OPPO设备token无效：" + oppoMsg
	case "10005":
		result.ErrorCode = "PAYLOAD_TOO_LARGE"
		result.ErrorMessage = "OPPO推送消息过大：" + oppoMsg
	case "10006":
		result.ErrorCode = "APP_NOT_FOUND"
		result.ErrorMessage = "OPPO应用未找到：" + oppoMsg
	case "10007":
		result.ErrorCode = "INVALID_CONFIG"
		result.ErrorMessage = "OPPO推送配置错误：" + oppoMsg
	case "20000":
		result.ErrorCode = "SERVER_ERROR"
		result.ErrorMessage = "OPPO推送服务器错误：" + oppoMsg
	case "20001":
		result.ErrorCode = "SERVER_ERROR"
		result.ErrorMessage = "OPPO推送服务暂时不可用：" + oppoMsg
	case "30000":
		result.ErrorCode = "INVALID_CHANNEL"
		result.ErrorMessage = "OPPO推送通道无效：" + oppoMsg
	default:
		result.ErrorCode = "OPPO_ERROR_" + oppoCode
		result.ErrorMessage = fmt.Sprintf("OPPO推送失败，错误码: %s, 错误信息: %s", oppoCode, oppoMsg)
	}
}

// createNetworkError 创建网络错误结果
func (a *AndroidProvider) createNetworkError(pushLog *models.PushLog, err error) *models.PushResult {
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      false,
		ResponseData: "{}",
	}

	// 检查错误类型
	errStr := err.Error()
	if strings.Contains(errStr, "timeout") || strings.Contains(errStr, "deadline exceeded") {
		result.ErrorCode = "NETWORK_TIMEOUT"
		result.ErrorMessage = "网络请求超时，请稍后重试"
	} else if strings.Contains(errStr, "connection refused") {
		result.ErrorCode = "CONNECTION_REFUSED"
		result.ErrorMessage = "连接被拒绝，请检查网络设置"
	} else if strings.Contains(errStr, "no such host") {
		result.ErrorCode = "DNS_ERROR"
		result.ErrorMessage = "DNS解析失败，请检查网络连接"
	} else if strings.Contains(errStr, "certificate") || strings.Contains(errStr, "tls") {
		result.ErrorCode = "TLS_ERROR"
		result.ErrorMessage = "TLS/SSL连接错误"
	} else {
		result.ErrorCode = "NETWORK_ERROR"
		result.ErrorMessage = fmt.Sprintf("网络请求失败: %v", err)
	}

	return result
}

// createAuthError 创建认证错误结果
func (a *AndroidProvider) createAuthError(pushLog *models.PushLog, provider string, err error) *models.PushResult {
	return &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      false,
		ErrorCode:    "AUTHENTICATION_ERROR",
		ErrorMessage: fmt.Sprintf("%s 认证失败: %v", provider, err),
		ResponseData: "{}",
	}
}

// createPayloadError 创建载荷错误结果
func (a *AndroidProvider) createPayloadError(pushLog *models.PushLog, err error) *models.PushResult {
	return &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      false,
		ErrorCode:    "PAYLOAD_ERROR",
		ErrorMessage: fmt.Sprintf("载荷序列化失败: %v", err),
		ResponseData: "{}",
	}
}

// createRequestError 创建请求构建错误结果
func (a *AndroidProvider) createRequestError(pushLog *models.PushLog, err error) *models.PushResult {
	return &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      false,
		ErrorCode:    "REQUEST_ERROR",
		ErrorMessage: fmt.Sprintf("创建请求失败: %v", err),
		ResponseData: "{}",
	}
}

// createResponseError 创建响应读取错误结果
func (a *AndroidProvider) createResponseError(pushLog *models.PushLog, err error) *models.PushResult {
	return &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      false,
		ErrorCode:    "RESPONSE_ERROR",
		ErrorMessage: fmt.Sprintf("读取响应失败: %v", err),
		ResponseData: "{}",
	}
}
