package push

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/doopush/doopush/api/internal/models"
)

// AndroidProvider Android推送服务提供者
type AndroidProvider struct {
	channel    string
	serverKey  string
	httpClient *http.Client
}

// NewAndroidProvider 创建Android推送提供者
func NewAndroidProvider(channel, serverKey string) *AndroidProvider {
	return &AndroidProvider{
		channel:   channel,
		serverKey: serverKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
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
	// 构建FCM载荷
	payload := FCMPayload{
		To: device.Token,
		Notification: FCMNotification{
			Title: pushLog.Title,
			Body:  pushLog.Content,
			Sound: "default",
			Badge: fmt.Sprintf("%d", pushLog.Badge), // FCM的badge是字符串形式
		},
		Priority: "high",
	}

	// 添加自定义数据
	dataMap := make(map[string]interface{})
	if pushLog.Payload != "" {
		var customData map[string]interface{}
		if err := json.Unmarshal([]byte(pushLog.Payload), &customData); err == nil {
			for k, v := range customData {
				dataMap[k] = v
			}
		}
	}

	// 添加badge到data字段，确保客户端可以获取
	dataMap["badge"] = pushLog.Badge
	dataMap["push_log_id"] = pushLog.ID
	if pushLog.DedupKey != "" {
		dataMap["dedup_key"] = pushLog.DedupKey
	}
	dataMap["dp_source"] = "doopush"

	payload.Data = dataMap

	// 模拟FCM推送
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		ResponseData: "{}", // 初始化为空 JSON 对象
	}

	// 模拟成功率85%
	if time.Now().UnixNano()%100 < 85 {
		result.Success = true
		fmt.Printf("模拟FCM推送成功: %s -> %s\n", device.Token[:20]+"...", pushLog.Title)
	} else {
		result.Success = false
		result.ErrorCode = "InvalidRegistration"
		result.ErrorMessage = "FCM注册令牌无效"
		fmt.Printf("模拟FCM推送失败: %s\n", result.ErrorMessage)
	}

	return result
}

// sendHuawei 发送华为推送
func (a *AndroidProvider) sendHuawei(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      time.Now().UnixNano()%100 < 80, // 80%成功率
		ResponseData: "{}",                           // 初始化为空 JSON 对象
	}

	if result.Success {
		fmt.Printf("模拟华为推送成功: %s -> %s (badge: %d)\n", device.Token[:20]+"...", pushLog.Title, pushLog.Badge)
	} else {
		result.ErrorCode = "HMS_ERROR"
		result.ErrorMessage = "华为推送服务暂时不可用"
	}

	return result
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
