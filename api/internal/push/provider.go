package push

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
)

// PushProvider 推送服务提供者接口
type PushProvider interface {
	SendPush(device *models.Device, pushLog *models.PushLog) *models.PushResult
}

// PushManager 推送管理器
type PushManager struct {
	providers map[string]PushProvider
}

// NewPushManager 创建推送管理器
func NewPushManager() *PushManager {
	return &PushManager{
		providers: make(map[string]PushProvider),
	}
}

// GetProvider 根据设备获取推送提供者
func (m *PushManager) GetProvider(device *models.Device) (PushProvider, error) {
	// 获取应用配置
	app := &models.App{}
	if err := database.DB.First(app, device.AppID).Error; err != nil {
		return nil, fmt.Errorf("应用不存在")
	}

	// 根据平台和通道选择提供者
	providerKey := fmt.Sprintf("%s_%s", device.Platform, device.Channel)

	if provider, exists := m.providers[providerKey]; exists {
		return provider, nil
	}

	// 动态创建提供者
	switch device.Platform {
	case "ios":
		return m.createAPNsProvider(app)
	case "android":
		return m.createAndroidProvider(app, device.Channel)
	default:
		return nil, fmt.Errorf("不支持的平台: %s", device.Platform)
	}
}

// createAPNsProvider 创建APNs提供者
func (m *PushManager) createAPNsProvider(app *models.App) (PushProvider, error) {
	// 获取APNs配置
	var config models.AppConfig
	err := database.DB.Where("app_id = ? AND platform = ? AND channel = ?", app.ID, "ios", "apns").First(&config).Error
	if err != nil {
		// 使用模拟推送
		fmt.Printf("警告: 应用 %s 未配置APNs证书，使用模拟推送\n", app.Name)
		return &MockAPNsProvider{}, nil
	}

	// 解析APNs配置
	var apnsConfig APNsConfig
	if err := json.Unmarshal([]byte(config.Config), &apnsConfig); err != nil {
		// 尝试解析旧格式配置
		var oldConfig struct {
			CertPEM     string `json:"cert_pem"`
			KeyPEM      string `json:"key_pem"`
			Environment string `json:"environment"`
		}

		if err := json.Unmarshal([]byte(config.Config), &oldConfig); err != nil {
			return nil, fmt.Errorf("APNs配置格式错误: %v", err)
		}

		// 转换为新格式
		apnsConfig = APNsConfig{
			Environment: oldConfig.Environment,
			CertPEM:     oldConfig.CertPEM,
			KeyPEM:      oldConfig.KeyPEM,
		}
	}

	// 使用新的配置创建提供者
	provider, err := NewAPNsProviderWithConfig(apnsConfig)
	if err != nil {
		fmt.Printf("警告: 应用 %s APNs配置无效，使用模拟推送: %v\n", app.Name, err)
		return &MockAPNsProvider{}, nil
	}

	return provider, nil
}

// createAndroidProvider 创建Android提供者
func (m *PushManager) createAndroidProvider(app *models.App, channel string) (PushProvider, error) {
	// 获取Android配置
	var config models.AppConfig
	err := database.DB.Where("app_id = ? AND platform = ? AND channel = ?", app.ID, "android", channel).First(&config).Error
	if err != nil {
		// 使用默认配置
		fmt.Printf("警告: 应用 %s 未配置 %s，使用模拟推送\n", app.Name, channel)
		return &MockAndroidProvider{channel: channel}, nil
	}

	// 解析配置
	var androidConfig AndroidConfig
	if err := json.Unmarshal([]byte(config.Config), &androidConfig); err != nil {
		return nil, fmt.Errorf("Android %s 配置格式错误", channel)
	}

	return NewAndroidProvider(channel, androidConfig), nil
}

// SendPush 统一推送接口
func (m *PushManager) SendPush(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	provider, err := m.GetProvider(device)
	if err != nil {
		return &models.PushResult{
			AppID:        pushLog.AppID,
			PushLogID:    pushLog.ID,
			Success:      false,
			ErrorCode:    "PROVIDER_ERROR",
			ErrorMessage: err.Error(),
			ResponseData: "{}", // 初始化为空 JSON 对象
		}
	}

	return provider.SendPush(device, pushLog)
}

// MockAPNsProvider 模拟APNs提供者 (用于开发测试)
type MockAPNsProvider struct{}

func (m *MockAPNsProvider) SendPush(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      time.Now().UnixNano()%10 < 9, // 90%成功率
		ResponseData: "{}",                         // 初始化为空 JSON 对象
	}

	if result.Success {
		fmt.Printf("✅ 模拟iOS推送成功: [%s] %s\n", pushLog.Title, pushLog.Content)
	} else {
		result.ErrorCode = "MOCK_FAILURE"
		result.ErrorMessage = "模拟推送失败"
		fmt.Printf("❌ 模拟iOS推送失败: %s\n", result.ErrorMessage)
	}

	return result
}

// MockAndroidProvider 模拟Android提供者 (用于开发测试)
type MockAndroidProvider struct {
	channel string
}

func (m *MockAndroidProvider) SendPush(device *models.Device, pushLog *models.PushLog) *models.PushResult {
	result := &models.PushResult{
		AppID:        pushLog.AppID,
		PushLogID:    pushLog.ID,
		Success:      time.Now().UnixNano()%10 < 8, // 80%成功率
		ResponseData: "{}",                         // 初始化为空 JSON 对象
	}

	if result.Success {
		fmt.Printf("✅ 模拟Android(%s)推送成功: [%s] %s\n", m.channel, pushLog.Title, pushLog.Content)
	} else {
		result.ErrorCode = "MOCK_FAILURE"
		result.ErrorMessage = fmt.Sprintf("模拟%s推送失败", m.channel)
		fmt.Printf("❌ 模拟Android(%s)推送失败: %s\n", m.channel, result.ErrorMessage)
	}

	return result
}

// ValidateConfig 验证推送配置
func (m *PushManager) ValidateConfig(platform, channel string, configJSON string) error {
	switch platform {
	case "ios":
		return m.validateAPNsConfig(configJSON)
	case "android":
		return m.validateAndroidConfig(channel, configJSON)
	default:
		return fmt.Errorf("不支持的平台: %s", platform)
	}
}

// validateAPNsConfig 验证APNs配置
func (m *PushManager) validateAPNsConfig(configJSON string) error {
	// 解析配置
	var apnsConfig APNsConfig
	if err := json.Unmarshal([]byte(configJSON), &apnsConfig); err != nil {
		// 尝试解析旧格式
		var oldConfig struct {
			CertPEM     string `json:"cert_pem"`
			KeyPEM      string `json:"key_pem"`
			Environment string `json:"environment"`
		}
		if err := json.Unmarshal([]byte(configJSON), &oldConfig); err != nil {
			return fmt.Errorf("配置格式错误: %v", err)
		}
		// 转换为新格式进行验证
		apnsConfig = APNsConfig{
			Environment: oldConfig.Environment,
			CertPEM:     oldConfig.CertPEM,
			KeyPEM:      oldConfig.KeyPEM,
		}
	}

	// 规范化配置字段（处理前端字段名兼容）
	normalizeConfig(&apnsConfig)

	// 验证必要字段
	if apnsConfig.Environment != "development" && apnsConfig.Environment != "production" {
		return fmt.Errorf("environment 必须是 'development' 或 'production'")
	}

	// 验证P8密钥配置
	if apnsConfig.AuthKeyP8 != "" {
		if apnsConfig.KeyID == "" {
			return fmt.Errorf("使用P8密钥时，key_id 不能为空")
		}
		if apnsConfig.TeamID == "" {
			return fmt.Errorf("使用P8密钥时，team_id 不能为空")
		}
		if apnsConfig.BundleID == "" {
			return fmt.Errorf("使用P8密钥时，bundle_id 不能为空")
		}
	} else if apnsConfig.CertPEM == "" || apnsConfig.KeyPEM == "" {
		return fmt.Errorf("必须提供P8密钥配置(key_id, team_id, bundle_id, private_key)或P12证书配置(cert_pem, key_pem)")
	}

	// 创建提供者来测试配置
	provider, err := NewAPNsProviderWithConfig(apnsConfig)
	if err != nil {
		return fmt.Errorf("配置无效: %v", err)
	}

	// 测试连接
	if err := provider.TestConnection(); err != nil {
		return fmt.Errorf("连接测试失败: %v", err)
	}

	return nil
}

// validateAndroidConfig 验证Android配置
func (m *PushManager) validateAndroidConfig(channel, configJSON string) error {
	var androidConfig struct {
		ServerKey   string `json:"server_key"`
		AppID       string `json:"app_id"`
		AppKey      string `json:"app_key"`
		AppSecret   string `json:"app_secret"`
		PackageName string `json:"package_name,omitempty"`
	}

	if err := json.Unmarshal([]byte(configJSON), &androidConfig); err != nil {
		return fmt.Errorf("配置格式错误: %v", err)
	}

	switch channel {
	case "fcm":
		if androidConfig.ServerKey == "" {
			return fmt.Errorf("FCM配置缺少server_key")
		}
	case "huawei", "oppo", "vivo":
		if androidConfig.AppID == "" {
			return fmt.Errorf("%s配置缺少app_id", channel)
		}
		if androidConfig.AppKey == "" {
			return fmt.Errorf("%s配置缺少app_key", channel)
		}
		if androidConfig.AppSecret == "" {
			return fmt.Errorf("%s配置缺少app_secret", channel)
		}
	case "xiaomi":
		if androidConfig.AppSecret == "" {
			return fmt.Errorf("小米推送配置缺少app_secret")
		}
		if androidConfig.AppID == "" {
			return fmt.Errorf("小米推送配置缺少app_id")
		}
		if androidConfig.AppKey == "" {
			return fmt.Errorf("小米推送配置缺少app_key")
		}
		// 小米的包名是可选的，如果没有提供则使用默认值
	default:
		return fmt.Errorf("不支持的Android推送通道: %s", channel)
	}

	// 对于小米推送，暂时跳过连接测试（需要真实的provider实例）
	if channel == "xiaomi" {
		// 这里可以添加基本的配置格式验证
		fmt.Printf("✅ 小米推送配置格式验证成功\n")
	}

	return nil
}

// TestConfigWithDevice 使用指定设备测试推送配置
func (m *PushManager) TestConfigWithDevice(title, content, platform, channel, deviceToken, configJSON string) *models.PushResult {
	// 创建模拟设备
	device := &models.Device{
		Token:    deviceToken,
		Platform: platform,
		Channel:  channel,
		Status:   1,
	}

	// 创建模拟推送日志
	pushLog := &models.PushLog{
		Title:   title,
		Content: content,
		Channel: channel,
		Status:  "testing",
	}

	// 根据平台创建临时提供者
	var provider PushProvider
	var err error

	switch platform {
	case "ios":
		var apnsConfig APNsConfig
		if err := json.Unmarshal([]byte(configJSON), &apnsConfig); err != nil {
			return &models.PushResult{
				Success:      false,
				ErrorCode:    "CONFIG_ERROR",
				ErrorMessage: "配置解析失败: " + err.Error(),
				ResponseData: "{}", // 初始化为空 JSON 对象
			}
		}
		// 规范化配置字段（处理前端字段名兼容）
		normalizeConfig(&apnsConfig)
		provider, err = NewAPNsProviderWithConfig(apnsConfig)
	case "android":
		provider = NewAndroidProvider(channel, AndroidConfig{})
		// TODO: 实现真实的Android推送提供者创建
	default:
		return &models.PushResult{
			Success:      false,
			ErrorCode:    "UNSUPPORTED_PLATFORM",
			ErrorMessage: "不支持的平台: " + platform,
			ResponseData: "{}", // 初始化为空 JSON 对象
		}
	}

	if err != nil {
		return &models.PushResult{
			Success:      false,
			ErrorCode:    "PROVIDER_ERROR",
			ErrorMessage: "创建推送提供者失败: " + err.Error(),
			ResponseData: "{}", // 初始化为空 JSON 对象
		}
	}

	// 执行实际推送测试
	return provider.SendPush(device, pushLog)
}
