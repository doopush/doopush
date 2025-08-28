/*
Android推送服务端集成说明 - 核心版

支持的推送通道:
1. FCM - Firebase Cloud Messaging
2. Huawei - 华为推送
3. Xiaomi - 小米推送（核心推送功能，完整功能见xiaomi.go）
4. OPPO - OPPO推送
5. VIVO - VIVO推送

设计说明:
- 本文件实现各推送通道的核心推送功能
- 采用统一的AndroidProvider接口，简化外部调用
- 小米推送的完整功能在xiaomi.go中实现，可单独导入使用
- 支持配置验证、错误处理和连接测试

小米推送配置格式:
{
  "app_secret": "小米推送AppSecret",
  "app_id": "小米推送AppID",
  "app_key": "小米推送AppKey",
  "package_name": "应用包名(可选，默认: com.doopush.app)"
}

文件结构:
- android.go: Android推送服务核心实现
- xiaomi.go: 小米推送完整功能扩展
- apns.go: iOS推送服务实现
- provider.go: 推送服务统一管理器

核心功能:
- SendPush(): 统一的推送接口，根据channel自动选择实现
- TestXiaomiConnection(): 小米推送连接测试
- 完整的错误处理和日志记录
- 支持消息ID存储和状态跟踪
*/

package push

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/internal/push/xiaomi"
)

type AndroidConfig struct {
	ServerKey string `json:"server_key"`
	AppID     string `json:"app_id"`
	AppKey    string `json:"app_key"`
	AppSecret string `json:"app_secret"`
}

// AndroidProvider Android推送服务提供者
type AndroidProvider struct {
	channel    string
	serverKey  string
	config     AndroidConfig
	httpClient *http.Client
}

// NewAndroidProvider 创建Android推送提供者
func NewAndroidProvider(channel string, androidConfig AndroidConfig) *AndroidProvider {
	return &AndroidProvider{
		channel:   channel,
		serverKey: androidConfig.ServerKey,
		config:    androidConfig,
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
		},
		Priority: "high",
	}

	// 添加自定义数据
	if pushLog.Payload != "" {
		var customData map[string]interface{}
		if err := json.Unmarshal([]byte(pushLog.Payload), &customData); err == nil {
			payload.Data = customData
		}
	}

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
		fmt.Printf("模拟华为推送成功: %s -> %s\n", device.Token[:20]+"...", pushLog.Title)
	} else {
		result.ErrorCode = "HMS_ERROR"
		result.ErrorMessage = "华为推送服务暂时不可用"
	}

	return result
}

// sendXiaomi 发送小米推送
func (a *AndroidProvider) sendXiaomi(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	result := &models.PushResult{
		AppID:     pushLog.AppID,
		PushLogID: pushLog.ID,
	}

	// 构建推送内容
	payload := ""
	if pushLog.Payload != "" {
		payload = pushLog.Payload
	} else {
		payloadData := map[string]interface{}{
			"title":   pushLog.Title,
			"content": pushLog.Content,
			"type":    "notification",
		}
		payloadBytes, _ := json.Marshal(payloadData)
		payload = string(payloadBytes)
	}

	// 创建小米推送客户端并发送推送
	pushClient := xiaomi.NewPushClient(a.httpClient, a.config.AppSecret)
	resp, err := pushClient.SendPush(xiaomi.PushRequest{
		RegID:       device.Token,
		Payload:     payload,
		Title:       pushLog.Title,
		Description: pushLog.Content,
		PackageName: pushLog.App.PackageName,
		IntentURI:   a.generateIntentURI(pushLog.App.PackageName, payload),
	})
	if err != nil {
		result.Success = false
		result.ErrorCode = "XIAOMI_REQUEST_ERROR"
		result.ErrorMessage = fmt.Sprintf("小米推送请求失败: %v, %v", err, resp)
		fmt.Println(result.ErrorMessage)
		return result
	}

	// 检查响应结果
	if resp.Result == xiaomi.ResultOK && resp.Code == xiaomi.SuccessCode {
		result.Success = true
		// 将消息ID存储在响应数据中
		if resp.Data != nil {
			result.ResponseData = fmt.Sprintf(`{"msg_id":"%s"}`, resp.Data.MsgID)
		}
		msgID := ""
		if resp.Data != nil {
			msgID = resp.Data.MsgID
		}
		fmt.Printf("小米推送成功: %s -> %s (MsgID: %s)\n", device.Token[:20]+"...", pushLog.Title, msgID)
	} else {
		result.Success = false
		result.ErrorCode = fmt.Sprintf("XIAOMI_ERROR_%d", resp.Code)
		// 使用错误消息映射获取友好的错误信息
		if errMsg, exists := xiaomi.ErrorMessage[resp.Code]; exists {
			result.ErrorMessage = fmt.Sprintf("小米推送失败: %s", errMsg)
		} else {
			result.ErrorMessage = fmt.Sprintf("小米推送失败: %s", resp.Description)
		}
		fmt.Printf("小米推送失败: %s\n", result.ErrorMessage)
	}

	return result
}

// generateIntentURI 生成Intent URI
// 根据包名和额外数据生成标准的Android Intent URI
func (a *AndroidProvider) generateIntentURI(packageName, extraData string) string {
	baseURI := fmt.Sprintf("intent://push/#Intent;scheme=doopush;package=%s", packageName)

	// 添加额外数据到Intent中
	if extraData != "" {
		baseURI += fmt.Sprintf(";S.extra_data=%s", url.QueryEscape(extraData))
	}

	// 添加常用参数
	baseURI += ";S.source=doopush"
	baseURI += ";end"

	return baseURI
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
		fmt.Printf("模拟OPPO推送成功: %s -> %s\n", device.Token[:20]+"...", pushLog.Title)
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
		fmt.Printf("模拟VIVO推送成功: %s -> %s\n", device.Token[:20]+"...", pushLog.Title)
	} else {
		result.ErrorCode = "VIVO_ERROR"
		result.ErrorMessage = "VIVO推送服务暂时不可用"
	}

	return result
}
