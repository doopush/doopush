package services

import (
	"errors"
	"strings"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	// TenantRegisterIPDailyLimit 同一来源 IP 24 小时内最多注册的租户数（含已删除），防止批量刷注册。
	TenantRegisterIPDailyLimit = 10
	// TenantPushMaxDevices 租户单次推送最多指定的设备数。
	TenantPushMaxDevices = 100
)

var (
	ErrTenantRegistrationDisabled = errors.New("该应用未开放租户注册")
	ErrTenantRegisterRateLimited  = errors.New("注册过于频繁，请稍后再试")
	ErrTenantInvalid              = errors.New("租户密钥无效")
	ErrTenantDisabled             = errors.New("租户已被禁用")
	ErrTenantNotFound             = errors.New("租户不存在")
	ErrTenantDeviceNotFound       = errors.New("设备未注册")
	ErrTenantQuotaExceeded        = errors.New("已超出今日推送上限")
)

type TenantService struct{}

func NewTenantService() *TenantService { return &TenantService{} }

// TenantListItem 控制台租户列表项。
type TenantListItem struct {
	models.Tenant
	DeviceCount    int64 `json:"device_count"`
	TodayPushCount int64 `json:"today_push_count"`
}

// RegisterTenant 自助注册租户，返回仅展示一次的明文密钥。
func (s *TenantService) RegisterTenant(appID uint, name, siteURL, ip string) (*models.Tenant, string, error) {
	plain := utils.GenerateSecureToken(models.TenantSecretPrefix)
	tenant := &models.Tenant{
		AppID: appID, Name: strings.TrimSpace(name), SiteURL: strings.TrimSpace(siteURL),
		SecretHash: utils.HashCredential(plain), Suffix: plain[len(plain)-8:],
		Status: 1, RegisterIP: ip,
	}
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// 锁住应用行，串行化同一应用下的“计数-创建”，避免并发请求绕过 IP 限额。
		var app models.App
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Select("id", "status", "tenant_registration").
			Where("id = ? AND status = 1", appID).First(&app).Error; err != nil {
			return ErrTenantRegistrationDisabled
		}
		if !app.TenantRegistration {
			return ErrTenantRegistrationDisabled
		}
		var count int64
		// 已删除的租户也计入，避免“注册-删除”循环绕过限额。
		if err := tx.Unscoped().Model(&models.Tenant{}).
			Where("app_id = ? AND register_ip = ? AND created_at > ?", appID, ip, time.Now().Add(-24*time.Hour)).
			Count(&count).Error; err != nil {
			return errors.New("注册租户失败")
		}
		if count >= TenantRegisterIPDailyLimit {
			return ErrTenantRegisterRateLimited
		}
		if err := tx.Create(tenant).Error; err != nil {
			return errors.New("注册租户失败")
		}
		return nil
	})
	if err != nil {
		return nil, "", err
	}
	return tenant, plain, nil
}

// AuthenticateTenant 校验租户密钥。已删除或密钥错误返回 ErrTenantInvalid（接入方可重新注册），
// 被禁用返回 ErrTenantDisabled（接入方不应重新注册绕过禁用）。
func (s *TenantService) AuthenticateTenant(appID uint, plain string) (*models.Tenant, error) {
	if !strings.HasPrefix(plain, models.TenantSecretPrefix) {
		return nil, ErrTenantInvalid
	}
	var tenant models.Tenant
	if err := database.DB.Where("app_id = ? AND secret_hash = ?", appID, utils.HashCredential(plain)).First(&tenant).Error; err != nil {
		return nil, ErrTenantInvalid
	}
	var app models.App
	if err := database.DB.Select("id").Where("id = ? AND status = 1", appID).First(&app).Error; err != nil {
		return nil, ErrTenantDisabled
	}
	if tenant.Status != 1 {
		return nil, ErrTenantDisabled
	}
	return &tenant, nil
}

// TouchTenant 记录最后使用时间，5 分钟内不重复写库。
func (s *TenantService) TouchTenant(tenant *models.Tenant, ip string) {
	now := time.Now()
	_ = database.DB.Model(&models.Tenant{}).
		Where("id = ? AND (last_used_at IS NULL OR last_used_at < ?)", tenant.ID, now.Add(-5*time.Minute)).
		Updates(map[string]interface{}{"last_used_at": now, "last_used_ip": ip}).Error
}

// BindDevice 按推送 Token 把设备绑定到租户。能提交 Token 即证明设备登录过该租户的服务器；
// 设备已属于其他租户时改绑（用户换了服务器，旧服务器随即失去推送权限）。
func (s *TenantService) BindDevice(tenant *models.Tenant, token string) (*models.Device, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, ErrTenantDeviceNotFound
	}
	var device models.Device
	if err := database.DB.Where("app_id = ? AND token_hash = ?", tenant.AppID, utils.HashString(token)).
		First(&device).Error; err != nil {
		return nil, ErrTenantDeviceNotFound
	}
	binding := models.TenantDevice{AppID: tenant.AppID, TenantID: tenant.ID, DeviceID: device.ID}
	if err := database.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "device_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"app_id", "tenant_id", "updated_at"}),
	}).Create(&binding).Error; err != nil {
		return nil, errors.New("绑定设备失败")
	}
	return &device, nil
}

// UnbindDevice 解除设备与租户的绑定；设备不属于该租户时视为已解绑。
func (s *TenantService) UnbindDevice(tenant *models.Tenant, deviceID uint) error {
	if err := database.DB.Where("tenant_id = ? AND device_id = ?", tenant.ID, deviceID).
		Delete(&models.TenantDevice{}).Error; err != nil {
		return errors.New("解绑设备失败")
	}
	return nil
}

// SplitBoundDevices 把设备 ID 分为属于该租户的和不属于的（去重，保持原顺序）。
func (s *TenantService) SplitBoundDevices(tenant *models.Tenant, deviceIDs []uint) (bound, unbound []uint, err error) {
	unique := make([]uint, 0, len(deviceIDs))
	seen := make(map[uint]struct{}, len(deviceIDs))
	for _, id := range deviceIDs {
		if _, ok := seen[id]; ok || id == 0 {
			continue
		}
		seen[id] = struct{}{}
		unique = append(unique, id)
	}
	var owned []uint
	if len(unique) > 0 {
		if err := database.DB.Model(&models.TenantDevice{}).
			Where("tenant_id = ? AND device_id IN ?", tenant.ID, unique).
			Pluck("device_id", &owned).Error; err != nil {
			return nil, nil, errors.New("查询设备归属失败")
		}
	}
	ownedSet := make(map[uint]struct{}, len(owned))
	for _, id := range owned {
		ownedSet[id] = struct{}{}
	}
	bound, unbound = []uint{}, []uint{}
	for _, id := range unique {
		if _, ok := ownedSet[id]; ok {
			bound = append(bound, id)
		} else {
			unbound = append(unbound, id)
		}
	}
	return bound, unbound, nil
}

// EffectiveDailyQuota 租户自身上限优先，否则取应用默认值；0 表示不限。
func (s *TenantService) EffectiveDailyQuota(tenant *models.Tenant) (int, error) {
	if tenant.DailyQuota > 0 {
		return tenant.DailyQuota, nil
	}
	var app models.App
	if err := database.DB.Select("id", "tenant_daily_quota").First(&app, tenant.AppID).Error; err != nil {
		return 0, errors.New("查询应用失败")
	}
	return app.TenantDailyQuota, nil
}

// CheckQuota 校验追加 n 条推送后是否超出今日上限。
func (s *TenantService) CheckQuota(tenant *models.Tenant, n int) error {
	quota, err := s.EffectiveDailyQuota(tenant)
	if err != nil {
		return err
	}
	if quota <= 0 {
		return nil
	}
	used, err := s.todayPushCount(tenant.ID)
	if err != nil {
		return err
	}
	if used+int64(n) > int64(quota) {
		return ErrTenantQuotaExceeded
	}
	return nil
}

func (s *TenantService) todayPushCount(tenantID uint) (int64, error) {
	var count int64
	if err := database.DB.Model(&models.PushLog{}).
		Where("tenant_id = ? AND created_at >= ?", tenantID, localDayStart(time.Now())).
		Count(&count).Error; err != nil {
		return 0, errors.New("查询推送用量失败")
	}
	return count, nil
}

// ListTenants 列出应用下的租户及设备数、今日推送数。
func (s *TenantService) ListTenants(appID uint) ([]TenantListItem, error) {
	var tenants []models.Tenant
	if err := database.DB.Where("app_id = ?", appID).Order("id DESC").Find(&tenants).Error; err != nil {
		return nil, errors.New("获取租户列表失败")
	}
	items := make([]TenantListItem, 0, len(tenants))
	if len(tenants) == 0 {
		return items, nil
	}
	ids := make([]uint, len(tenants))
	for i, t := range tenants {
		ids[i] = t.ID
	}
	type countRow struct {
		TenantID uint
		Total    int64
	}
	var deviceRows, pushRows []countRow
	if err := database.DB.Model(&models.TenantDevice{}).Select("tenant_id, COUNT(*) AS total").
		Where("tenant_id IN ?", ids).Group("tenant_id").Scan(&deviceRows).Error; err != nil {
		return nil, errors.New("获取租户列表失败")
	}
	if err := database.DB.Model(&models.PushLog{}).Select("tenant_id, COUNT(*) AS total").
		Where("tenant_id IN ? AND created_at >= ?", ids, localDayStart(time.Now())).
		Group("tenant_id").Scan(&pushRows).Error; err != nil {
		return nil, errors.New("获取租户列表失败")
	}
	devices := make(map[uint]int64, len(deviceRows))
	for _, r := range deviceRows {
		devices[r.TenantID] = r.Total
	}
	pushes := make(map[uint]int64, len(pushRows))
	for _, r := range pushRows {
		pushes[r.TenantID] = r.Total
	}
	for _, t := range tenants {
		items = append(items, TenantListItem{Tenant: t, DeviceCount: devices[t.ID], TodayPushCount: pushes[t.ID]})
	}
	return items, nil
}

// UpdateTenant 控制台修改租户状态或每日上限。
func (s *TenantService) UpdateTenant(appID, tenantID uint, status, dailyQuota *int) (*models.Tenant, map[string]interface{}, error) {
	var tenant models.Tenant
	if err := database.DB.Where("id = ? AND app_id = ?", tenantID, appID).First(&tenant).Error; err != nil {
		return nil, nil, ErrTenantNotFound
	}
	before := map[string]interface{}{"status": tenant.Status, "daily_quota": tenant.DailyQuota}
	updates := map[string]interface{}{}
	if status != nil {
		updates["status"] = *status
	}
	if dailyQuota != nil {
		updates["daily_quota"] = *dailyQuota
	}
	if len(updates) > 0 {
		if err := database.DB.Model(&tenant).Updates(updates).Error; err != nil {
			return nil, nil, errors.New("更新租户失败")
		}
	}
	return &tenant, before, nil
}

// DeleteTenant 删除租户并解除其全部设备绑定。删除后其密钥立即失效，接入方会重新注册为新租户。
func (s *TenantService) DeleteTenant(appID, tenantID uint) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Where("id = ? AND app_id = ?", tenantID, appID).Delete(&models.Tenant{})
		if result.Error != nil {
			return errors.New("删除租户失败")
		}
		if result.RowsAffected == 0 {
			return ErrTenantNotFound
		}
		if err := tx.Where("tenant_id = ?", tenantID).Delete(&models.TenantDevice{}).Error; err != nil {
			return errors.New("删除租户失败")
		}
		return nil
	})
}

// UpdateTenantSettings 修改应用的租户自助注册开关与默认每日上限。
func (s *TenantService) UpdateTenantSettings(appID uint, registration *bool, dailyQuota *int) (*models.App, map[string]interface{}, error) {
	var app models.App
	if err := database.DB.First(&app, appID).Error; err != nil {
		return nil, nil, errors.New("应用不存在")
	}
	before := map[string]interface{}{"tenant_registration": app.TenantRegistration, "tenant_daily_quota": app.TenantDailyQuota}
	updates := map[string]interface{}{}
	if registration != nil {
		updates["tenant_registration"] = *registration
	}
	if dailyQuota != nil {
		updates["tenant_daily_quota"] = *dailyQuota
	}
	if len(updates) > 0 {
		if err := database.DB.Model(&app).Updates(updates).Error; err != nil {
			return nil, nil, errors.New("更新租户设置失败")
		}
	}
	return &app, before, nil
}
