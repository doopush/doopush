package push

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
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
		// 配置不存在，返回错误而非模拟推送
		return nil, fmt.Errorf("应用 %s 未配置 %s 推送服务，请先配置推送参数", app.Name, channel)
	}

	// 解析配置
	var androidConfig AndroidConfig
	if err := json.Unmarshal([]byte(config.Config), &androidConfig); err != nil {
		return nil, fmt.Errorf("Android %s 配置格式错误: %v", channel, err)
	}

	// 根据通道类型验证和创建提供者
	switch channel {
	case "fcm":
		return m.createFCMProvider(androidConfig)
	case "huawei":
		return m.createHuaweiProvider(androidConfig)
	case "honor":
		return m.createHonorProvider(androidConfig)
	case "xiaomi":
		return m.createXiaomiProvider(androidConfig)
	case "oppo":
		return m.createOppoProvider(androidConfig)
	case "vivo":
		return m.createVivoProvider(androidConfig)
	case "meizu":
		return m.createMeizuProvider(androidConfig)
	default:
		return nil, fmt.Errorf("暂不支持的 Android 推送通道: %s", channel)
	}
}

// createFCMProvider 创建FCM推送提供者
func (m *PushManager) createFCMProvider(config AndroidConfig) (PushProvider, error) {
	// 检查新格式配置（FCM v1 API）
	if config.ServiceAccountKey != "" {
		// 验证服务账号密钥格式并检查是否包含project_id
		var serviceAccountKey map[string]interface{}
		if err := json.Unmarshal([]byte(config.ServiceAccountKey), &serviceAccountKey); err != nil {
			return nil, fmt.Errorf("FCM 服务账号密钥格式错误: %v", err)
		}

		// 检查是否包含必要的项目ID
		if projectID, exists := serviceAccountKey["project_id"]; !exists || projectID == "" {
			return nil, fmt.Errorf("FCM 服务账号密钥中缺少 project_id 字段")
		}

		return NewAndroidProviderWithConfig("fcm", config), nil
	}

	return nil, fmt.Errorf("FCM 配置缺少必要参数，需要 service_account_key（JSON格式，包含项目ID）")
}

// createHuaweiProvider 创建华为推送提供者
func (m *PushManager) createHuaweiProvider(config AndroidConfig) (PushProvider, error) {
	if config.AppID == "" {
		return nil, fmt.Errorf("华为推送配置缺少 app_id")
	}
	if config.AppSecret == "" {
		return nil, fmt.Errorf("华为推送配置缺少 app_secret")
	}
	return NewAndroidProviderWithConfig("huawei", config), nil
}

// createXiaomiProvider 创建小米推送提供者
func (m *PushManager) createXiaomiProvider(config AndroidConfig) (PushProvider, error) {
	if config.AppID == "" {
		return nil, fmt.Errorf("小米推送配置缺少 app_id")
	}
	if config.AppKey == "" {
		return nil, fmt.Errorf("小米推送配置缺少 app_key")
	}
	if config.AppSecret == "" {
		return nil, fmt.Errorf("小米推送配置缺少 app_secret")
	}
	return NewAndroidProviderWithConfig("xiaomi", config), nil
}

// createOppoProvider 创建OPPO推送提供者
func (m *PushManager) createOppoProvider(config AndroidConfig) (PushProvider, error) {
	if config.AppID == "" {
		return nil, fmt.Errorf("OPPO推送配置缺少 app_id")
	}
	if config.AppKey == "" {
		return nil, fmt.Errorf("OPPO推送配置缺少 app_key")
	}
	if config.AppSecret == "" {
		return nil, fmt.Errorf("OPPO推送配置缺少 app_secret")
	}
	return NewAndroidProviderWithConfig("oppo", config), nil
}

// createVivoProvider 创建VIVO推送提供者
func (m *PushManager) createVivoProvider(config AndroidConfig) (PushProvider, error) {
	if config.AppID == "" {
		return nil, fmt.Errorf("VIVO推送配置缺少 app_id")
	}
	if config.AppKey == "" {
		return nil, fmt.Errorf("VIVO推送配置缺少 app_key")
	}
	if config.AppSecret == "" {
		return nil, fmt.Errorf("VIVO推送配置缺少 app_secret")
	}
	return NewAndroidProviderWithConfig("vivo", config), nil
}

// createMeizuProvider 创建魅族推送提供者
func (m *PushManager) createMeizuProvider(config AndroidConfig) (PushProvider, error) {
	if config.AppID == "" {
		return nil, fmt.Errorf("魅族推送配置缺少 app_id")
	}
	if config.AppSecret == "" {
		return nil, fmt.Errorf("魅族推送配置缺少 app_secret")
	}
	return NewAndroidProviderWithConfig("meizu", config), nil
}

// createHonorProvider 创建荣耀推送提供者
func (m *PushManager) createHonorProvider(config AndroidConfig) (PushProvider, error) {
	if config.AppID == "" {
		return nil, fmt.Errorf("荣耀推送配置缺少 app_id")
	}
	if config.ClientID == "" {
		return nil, fmt.Errorf("荣耀推送配置缺少 client_id")
	}
	if config.ClientSecret == "" {
		return nil, fmt.Errorf("荣耀推送配置缺少 client_secret")
	}
	return NewAndroidProviderWithConfig("honor", config), nil
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
	var androidConfig AndroidConfig
	if err := json.Unmarshal([]byte(configJSON), &androidConfig); err != nil {
		return fmt.Errorf("配置格式错误: %v", err)
	}

	switch channel {
	case "fcm":
		// 检查新格式配置（FCM v1 API）
		if androidConfig.ServiceAccountKey != "" {
			// 验证服务账号密钥格式并检查是否包含project_id
			var serviceAccountKey map[string]interface{}
			if err := json.Unmarshal([]byte(androidConfig.ServiceAccountKey), &serviceAccountKey); err != nil {
				return fmt.Errorf("FCM 服务账号密钥格式错误: %v", err)
			}

			// 检查是否包含必要的项目ID
			if projectID, exists := serviceAccountKey["project_id"]; !exists || projectID == "" {
				return fmt.Errorf("FCM 服务账号密钥中缺少 project_id 字段")
			}

			return nil // 新格式配置有效
		}

		return fmt.Errorf("FCM 配置缺少必要参数，需要 service_account_key（JSON格式，包含项目ID）")

	case "huawei":
		if androidConfig.AppID == "" {
			return fmt.Errorf("华为推送配置缺少 app_id")
		}
		if androidConfig.AppSecret == "" {
			return fmt.Errorf("华为推送配置缺少 app_secret")
		}
		return nil

	case "honor":
		if androidConfig.AppID == "" {
			return fmt.Errorf("荣耀推送配置缺少 app_id")
		}
		if androidConfig.ClientID == "" {
			return fmt.Errorf("荣耀推送配置缺少 client_id")
		}
		if androidConfig.ClientSecret == "" {
			return fmt.Errorf("荣耀推送配置缺少 client_secret")
		}
		return nil

	case "xiaomi":
		if androidConfig.AppID == "" {
			return fmt.Errorf("小米推送配置缺少 app_id")
		}
		if androidConfig.AppKey == "" {
			return fmt.Errorf("小米推送配置缺少 app_key")
		}
		if androidConfig.AppSecret == "" {
			return fmt.Errorf("小米推送配置缺少 app_secret")
		}
		return nil

	case "oppo":
		if androidConfig.AppID == "" {
			return fmt.Errorf("OPPO推送配置缺少 app_id")
		}
		if androidConfig.AppKey == "" {
			return fmt.Errorf("OPPO推送配置缺少 app_key")
		}
		if androidConfig.AppSecret == "" {
			return fmt.Errorf("OPPO推送配置缺少 app_secret")
		}
		return nil

	case "vivo":
		if androidConfig.AppID == "" {
			return fmt.Errorf("VIVO推送配置缺少 app_id")
		}
		if androidConfig.AppKey == "" {
			return fmt.Errorf("VIVO推送配置缺少 app_key")
		}
		if androidConfig.AppSecret == "" {
			return fmt.Errorf("VIVO推送配置缺少 app_secret")
		}
		return nil

	case "meizu":
		if androidConfig.AppID == "" {
			return fmt.Errorf("魅族推送配置缺少 app_id")
		}
		if androidConfig.AppSecret == "" {
			return fmt.Errorf("魅族推送配置缺少 app_secret")
		}
		return nil

	default:
		return fmt.Errorf("暂不支持的 Android 推送通道: %s", channel)
	}
}

// TestConfigWithDevice 使用指定设备测试推送配置
func (m *PushManager) TestConfigWithDevice(appID uint, title, content, platform, channel, deviceToken, configJSON string) *models.PushResult {
	// 创建模拟设备
	device := &models.Device{
		Token:    deviceToken,
		Platform: platform,
		Channel:  channel,
		Status:   1,
	}

	// 创建模拟推送日志
	dedupKey := utils.HashString(fmt.Sprintf("%d_%s_%s_%s", appID, title, content, deviceToken))
	pushLog := &models.PushLog{
		Title:    title,
		Content:  content,
		Channel:  channel,
		Status:   "testing",
		DedupKey: dedupKey,
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
		var androidConfig AndroidConfig
		if err := json.Unmarshal([]byte(configJSON), &androidConfig); err != nil {
			return &models.PushResult{
				Success:      false,
				ErrorCode:    "CONFIG_ERROR",
				ErrorMessage: "Android配置解析失败: " + err.Error(),
				ResponseData: "{}", // 初始化为空 JSON 对象
			}
		}

		// 根据通道类型创建提供者
		switch channel {
		case "fcm":
			provider, err = m.createFCMProvider(androidConfig)
		case "huawei":
			provider, err = m.createHuaweiProvider(androidConfig)
		case "honor":
			provider, err = m.createHonorProvider(androidConfig)
		case "xiaomi":
			provider, err = m.createXiaomiProvider(androidConfig)
		case "oppo":
			provider, err = m.createOppoProvider(androidConfig)
		case "vivo":
			provider, err = m.createVivoProvider(androidConfig)
		case "meizu":
			provider, err = m.createMeizuProvider(androidConfig)
		default:
			return &models.PushResult{
				Success:      false,
				ErrorCode:    "UNSUPPORTED_CHANNEL",
				ErrorMessage: "暂不支持的 Android 推送通道: " + channel,
				ResponseData: "{}", // 初始化为空 JSON 对象
			}
		}
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
