package services

import (
	"errors"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
)

// DeviceService 设备服务
type DeviceService struct{}

// NewDeviceService 创建设备服务
func NewDeviceService() *DeviceService {
	return &DeviceService{}
}

// RegisterDevice 注册设备
func (s *DeviceService) RegisterDevice(appID uint, token, bundleID, platform, channel, brand, model, systemVer, appVersion, userAgent string) (*models.Device, error) {
	// 1. 验证应用是否存在并获取应用信息
	var app models.App
	if err := database.DB.Where("id = ? AND status = 1", appID).First(&app).Error; err != nil {
		return nil, errors.New("应用不存在或已被禁用")
	}

	// 2. 验证bundle ID是否与应用的package_name匹配
	if bundleID != app.PackageName {
		return nil, errors.New("Bundle ID与应用包名不匹配")
	}

	// 检查设备是否已存在
	tokenHash := utils.HashString(token)
	var existingDevice models.Device

	if err := database.DB.Where("app_id = ? AND token_hash = ?", appID, tokenHash).First(&existingDevice).Error; err == nil {
		// 设备已存在，更新信息
		updates := map[string]interface{}{
			"brand":       brand,
			"model":       model,
			"system_ver":  systemVer,
			"app_version": appVersion,
			"user_agent":  userAgent,
			"status":      1,
			"last_seen":   utils.TimeNow(),
		}

		if err := database.DB.Preload("App").Model(&existingDevice).Updates(updates).Error; err != nil {
			return nil, errors.New("设备信息更新失败")
		}

		return &existingDevice, nil
	}

	// 创建新设备
	device := &models.Device{
		AppID:      appID,
		Token:      token,
		TokenHash:  tokenHash,
		Platform:   platform,
		Channel:    channel,
		Brand:      brand,
		Model:      model,
		SystemVer:  systemVer,
		AppVersion: appVersion,
		UserAgent:  userAgent,
		Status:     1,
		LastSeen:   &[]time.Time{utils.TimeNow()}[0],
	}

	if err := database.DB.Preload("App").Create(device).Error; err != nil {
		return nil, errors.New("设备注册失败")
	}

	return device, nil
}

// GetDevices 获取设备列表
func (s *DeviceService) GetDevices(appID uint, userID uint, page, pageSize int, platform, status string) ([]models.Device, int64, error) {
	// 检查用户权限
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, appID, "viewer")
	if err != nil {
		return nil, 0, errors.New("权限检查失败")
	}
	if !hasPermission {
		return nil, 0, errors.New("无权限访问该应用")
	}

	// 构建查询条件
	query := database.DB.Preload("App").Where("app_id = ?", appID)

	if platform != "" {
		query = query.Where("platform = ?", platform)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// 获取总数
	var total int64
	query.Model(&models.Device{}).Count(&total)

	// 分页查询
	var devices []models.Device
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&devices).Error; err != nil {
		return nil, 0, errors.New("获取设备列表失败")
	}

	return devices, total, nil
}

// GetDeviceByID 根据ID获取设备
func (s *DeviceService) GetDeviceByID(deviceID uint, userID uint) (*models.Device, error) {
	var device models.Device
	if err := database.DB.Preload("App").Where("id = ?", deviceID).First(&device).Error; err != nil {
		return nil, errors.New("设备不存在")
	}

	// 检查用户权限
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, device.AppID, "viewer")
	if err != nil {
		return nil, errors.New("权限检查失败")
	}
	if !hasPermission {
		return nil, errors.New("无权限访问该设备")
	}

	return &device, nil
}

// UpdateDeviceStatus 更新设备状态
func (s *DeviceService) UpdateDeviceStatus(deviceID uint, userID uint, status int) error {
	var device models.Device
	if err := database.DB.Where("id = ?", deviceID).First(&device).Error; err != nil {
		return errors.New("设备不存在")
	}

	// 检查用户权限 (需要developer以上权限)
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, device.AppID, "developer")
	if err != nil {
		return errors.New("权限检查失败")
	}
	if !hasPermission {
		return errors.New("无权限修改该设备")
	}

	// 更新状态
	if err := database.DB.Preload("App").Model(&device).Update("status", status).Error; err != nil {
		return errors.New("设备状态更新失败")
	}

	return nil
}

// DeleteDevice 删除设备
func (s *DeviceService) DeleteDevice(deviceID uint, userID uint) error {
	var device models.Device
	if err := database.DB.Where("id = ?", deviceID).First(&device).Error; err != nil {
		return errors.New("设备不存在")
	}

	// 检查用户权限 (需要developer以上权限)
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, device.AppID, "developer")
	if err != nil {
		return errors.New("权限检查失败")
	}
	if !hasPermission {
		return errors.New("无权限删除该设备")
	}

	// 软删除设备
	if err := database.DB.Delete(&device).Error; err != nil {
		return errors.New("设备删除失败")
	}

	return nil
}

// GetDeviceByToken 根据token获取设备
func (s *DeviceService) GetDeviceByToken(appID uint, token string, userID uint) (*models.Device, error) {
	tokenHash := utils.HashString(token)

	var device models.Device
	if err := database.DB.Preload("App").Where("app_id = ? AND token_hash = ?", appID, tokenHash).First(&device).Error; err != nil {
		return nil, errors.New("设备不存在")
	}

	// 检查用户权限
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, device.AppID, "viewer")
	if err != nil {
		return nil, errors.New("权限检查失败")
	}
	if !hasPermission {
		return nil, errors.New("无权限访问该设备")
	}

	return &device, nil
}

// UpdateDeviceStatusByToken 根据token更新设备状态
func (s *DeviceService) UpdateDeviceStatusByToken(appID uint, token string, userID uint, status int) error {
	tokenHash := utils.HashString(token)

	var device models.Device
	if err := database.DB.Where("app_id = ? AND token_hash = ?", appID, tokenHash).First(&device).Error; err != nil {
		return errors.New("设备不存在")
	}

	// 检查用户权限 (需要developer以上权限)
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, device.AppID, "developer")
	if err != nil {
		return errors.New("权限检查失败")
	}
	if !hasPermission {
		return errors.New("无权限修改该设备")
	}

	// 更新状态
	if err := database.DB.Model(&device).Update("status", status).Error; err != nil {
		return errors.New("设备状态更新失败")
	}

	return nil
}

// DeleteDeviceByToken 根据token删除设备
func (s *DeviceService) DeleteDeviceByToken(appID uint, token string, userID uint) error {
	tokenHash := utils.HashString(token)

	var device models.Device
	if err := database.DB.Where("app_id = ? AND token_hash = ?", appID, tokenHash).First(&device).Error; err != nil {
		return errors.New("设备不存在")
	}

	// 检查用户权限 (需要developer以上权限)
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, device.AppID, "developer")
	if err != nil {
		return errors.New("权限检查失败")
	}
	if !hasPermission {
		return errors.New("无权限删除该设备")
	}

	// 软删除设备
	if err := database.DB.Delete(&device).Error; err != nil {
		return errors.New("设备删除失败")
	}

	return nil
}
