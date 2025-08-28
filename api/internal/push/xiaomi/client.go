package xiaomi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

type PushClient struct {
	appSecret  string
	httpClient *http.Client
}

func NewPushClient(httpClient *http.Client, appSecret string) *PushClient {
	return &PushClient{
		httpClient: httpClient,
		appSecret:  appSecret,
	}
}

func (c *PushClient) SendPush(pushReq PushRequest) (*PushResponse, error) {

	// 构建表单数据
	formData := url.Values{}
	formData.Set("payload", url.QueryEscape(pushReq.Payload))
	formData.Set("restricted_package_name", pushReq.PackageName)
	formData.Set("pass_through", PassThroughNotification) // 0 表示通知栏消息，1 表示透传消息
	formData.Set("title", pushReq.Title)
	formData.Set("description", pushReq.Description)
	formData.Set("registration_id", pushReq.RegID)
	formData.Set("extra.notify_effect", NotifyEffectActivity) // 2 表示通知栏点击后打开app的任一Activity
	formData.Set("extra.intent_uri", pushReq.IntentURI)
	formData.Set("time_to_live", TTLDefault)

	req, err := http.NewRequest("POST", URLPush, bytes.NewBufferString(formData.Encode()))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %v", err)
	}

	// 设置正确的请求头
	req.Header.Set("Authorization", fmt.Sprintf("key=%s", c.appSecret))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("发送请求失败: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %v", err)
	}

	// 解析响应
	var pushResp PushResponse
	if err := json.Unmarshal(body, &pushResp); err != nil {
		return nil, fmt.Errorf("解析响应失败: %v, 响应内容: %s", err, string(body))
	}
	return &pushResp, nil
}
