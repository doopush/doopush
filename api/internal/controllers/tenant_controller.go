package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// TenantController 租户（共享通道）接口：自助注册、设备绑定、限定范围推送，以及控制台管理。
type TenantController struct {
	tenantService *services.TenantService
	pushService   *services.PushService
}

func NewTenantController() *TenantController {
	return &TenantController{
		tenantService: services.NewTenantService(),
		pushService:   services.NewPushService(),
	}
}

type RegisterTenantRequest struct {
	Name    string `json:"name" binding:"required,max=100" example:"DooTask"`
	SiteURL string `json:"site_url" binding:"omitempty,max=255" example:"https://dootask.example.com"`
}

type BindTenantDeviceRequest struct {
	Token string `json:"token" binding:"required,max=500" example:"device_token_here"`
}

type TenantPushRequest struct {
	Title     string      `json:"title" binding:"required,max=200" example:"新消息"`
	Content   string      `json:"content" binding:"required" example:"您有一条新消息"`
	Payload   PushPayload `json:"payload,omitempty"`
	DeviceIDs []uint      `json:"device_ids" binding:"required,min=1,max=100"`
	Badge     *int        `json:"badge,omitempty" example:"1"`
}

type UpdateTenantRequest struct {
	Status     *int `json:"status" binding:"omitempty,oneof=0 1"`
	DailyQuota *int `json:"daily_quota" binding:"omitempty,min=0"`
}

type UpdateTenantSettingsRequest struct {
	TenantRegistration *bool `json:"tenant_registration"`
	TenantDailyQuota   *int  `json:"tenant_daily_quota" binding:"omitempty,min=0"`
}

func tenantFromContext(c *gin.Context) *models.Tenant {
	value, _ := c.Get("tenant")
	tenant, _ := value.(*models.Tenant)
	return tenant
}

// Register 租户自助注册
// @Summary 注册租户
// @Description 接入方使用客户端 App Key 自助注册租户，获得仅展示一次的租户密钥。需要应用开启“允许租户自助注册”，同一 IP 24 小时内最多注册 10 个。
// @Tags 租户
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param X-App-Key header string true "App Key"
// @Param request body RegisterTenantRequest true "租户信息"
// @Success 201 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse "应用未开放租户注册"
// @Failure 429 {object} response.APIResponse "注册过于频繁"
// @Router /apps/{appId}/tenants [post]
func (t *TenantController) Register(c *gin.Context) {
	var req RegisterTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}
	tenant, plain, err := t.tenantService.RegisterTenant(c.GetUint("app_id"), req.Name, req.SiteURL, c.ClientIP())
	if err != nil {
		switch {
		case errors.Is(err, services.ErrTenantRegistrationDisabled):
			response.Forbidden(c, err.Error())
		case errors.Is(err, services.ErrTenantRegisterRateLimited):
			response.Error(c, http.StatusTooManyRequests, err.Error())
		default:
			response.InternalServerError(c, err.Error())
		}
		return
	}
	c.JSON(http.StatusCreated, response.APIResponse{Code: http.StatusCreated, Message: "租户注册成功", Data: gin.H{
		"tenant_id":     tenant.ID,
		"tenant_secret": plain,
	}})
}

// BindDevice 按推送 Token 绑定设备
// @Summary 绑定设备到租户
// @Description 按设备推送 Token 把已在 DooPush 注册的设备绑定到当前租户；设备已属于其他租户时改绑。返回 DooPush 设备 ID。
// @Tags 租户
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param request body BindTenantDeviceRequest true "设备推送 Token"
// @Success 200 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse "设备未注册"
// @Router /apps/{appId}/tenant/devices [post]
func (t *TenantController) BindDevice(c *gin.Context) {
	var req BindTenantDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}
	device, err := t.tenantService.BindDevice(tenantFromContext(c), req.Token)
	if err != nil {
		if errors.Is(err, services.ErrTenantDeviceNotFound) {
			response.NotFound(c, err.Error())
		} else {
			response.InternalServerError(c, err.Error())
		}
		return
	}
	response.Success(c, gin.H{
		"device_id":        device.ID,
		"platform":         device.Platform,
		"channel":          device.Channel,
		"push_environment": device.PushEnv,
	})
}

// UnbindDevice 解绑设备
// @Summary 从租户解绑设备
// @Description 解除设备与当前租户的绑定；设备不属于当前租户时视为成功。
// @Tags 租户
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param deviceId path int true "设备ID"
// @Success 200 {object} response.APIResponse
// @Router /apps/{appId}/tenant/devices/{deviceId} [delete]
func (t *TenantController) UnbindDevice(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("deviceId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的设备ID")
		return
	}
	if err := t.tenantService.UnbindDevice(tenantFromContext(c), uint(deviceID)); err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "设备已解绑"})
}

// Push 租户推送
// @Summary 租户推送
// @Description 向绑定到当前租户的设备推送，单次最多 100 台；不属于当前租户的设备会被忽略并在 unbound_device_ids 中返回。受租户每日推送上限约束。
// @Tags 租户
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param request body TenantPushRequest true "推送信息"
// @Success 200 {object} response.APIResponse
// @Failure 429 {object} response.APIResponse "超出今日推送上限"
// @Router /apps/{appId}/tenant/push [post]
func (t *TenantController) Push(c *gin.Context) {
	var req TenantPushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}
	tenant := tenantFromContext(c)
	bound, unbound, err := t.tenantService.SplitBoundDevices(tenant, req.DeviceIDs)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	result := gin.H{"count": 0, "unbound_device_ids": unbound}
	if len(bound) == 0 {
		response.Success(c, result)
		return
	}
	if err := t.tenantService.CheckQuota(tenant, len(bound)); err != nil {
		if errors.Is(err, services.ErrTenantQuotaExceeded) {
			response.Error(c, http.StatusTooManyRequests, err.Error())
		} else {
			response.InternalServerError(c, err.Error())
		}
		return
	}
	tenantID := tenant.ID
	pushLogs, err := t.pushService.SendPush(tenant.AppID, 0, services.PushRequest{
		Title:    req.Title,
		Content:  req.Content,
		Badge:    req.Badge,
		Payload:  req.Payload.toMap(),
		Target:   services.PushTarget{Type: "devices", DeviceIDs: bound},
		TenantID: &tenantID,
	})
	// 已绑定的设备可能全部在线（走网关）或已停用，此时没有可下发的离线推送，不视为错误。
	if err != nil && err.Error() != "没有找到目标设备" {
		response.Error(c, http.StatusUnprocessableEntity, err.Error())
		return
	}
	result["count"] = len(pushLogs)
	response.Success(c, result)
}

// List 控制台：租户列表
// @Summary 获取租户列表
// @Tags 租户
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Success 200 {object} response.APIResponse{data=[]services.TenantListItem}
// @Router /apps/{appId}/tenants [get]
func (t *TenantController) List(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}
	items, err := t.tenantService.ListTenants(uint(appID))
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.Success(c, items)
}

// Update 控制台：修改租户状态或每日上限
// @Summary 更新租户
// @Tags 租户
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param tenantId path int true "租户ID"
// @Param request body UpdateTenantRequest true "更新内容"
// @Success 200 {object} response.APIResponse{data=models.Tenant}
// @Router /apps/{appId}/tenants/{tenantId} [patch]
func (t *TenantController) Update(c *gin.Context) {
	appID, appErr := strconv.ParseUint(c.Param("appId"), 10, 32)
	tenantID, tenantErr := strconv.ParseUint(c.Param("tenantId"), 10, 32)
	if appErr != nil || tenantErr != nil {
		response.BadRequest(c, "无效的应用或租户ID")
		return
	}
	var req UpdateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}
	tenant, before, err := t.tenantService.UpdateTenant(uint(appID), uint(tenantID), req.Status, req.DailyQuota)
	if err != nil {
		if errors.Is(err, services.ErrTenantNotFound) {
			response.NotFound(c, err.Error())
		} else {
			response.InternalServerError(c, err.Error())
		}
		return
	}
	c.Set("audit_before_data", before)
	c.Set("audit_after_data", gin.H{"status": tenant.Status, "daily_quota": tenant.DailyQuota})
	response.Success(c, tenant)
}

// Delete 控制台：删除租户
// @Summary 删除租户
// @Description 删除租户并解除其全部设备绑定，其密钥立即失效。
// @Tags 租户
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param tenantId path int true "租户ID"
// @Success 200 {object} response.APIResponse
// @Router /apps/{appId}/tenants/{tenantId} [delete]
func (t *TenantController) Delete(c *gin.Context) {
	appID, appErr := strconv.ParseUint(c.Param("appId"), 10, 32)
	tenantID, tenantErr := strconv.ParseUint(c.Param("tenantId"), 10, 32)
	if appErr != nil || tenantErr != nil {
		response.BadRequest(c, "无效的应用或租户ID")
		return
	}
	if err := t.tenantService.DeleteTenant(uint(appID), uint(tenantID)); err != nil {
		if errors.Is(err, services.ErrTenantNotFound) {
			response.NotFound(c, err.Error())
		} else {
			response.InternalServerError(c, err.Error())
		}
		return
	}
	response.Success(c, gin.H{"message": "租户已删除"})
}

// UpdateSettings 控制台：租户设置（自助注册开关、默认每日上限）
// @Summary 更新租户设置
// @Tags 租户
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param request body UpdateTenantSettingsRequest true "租户设置"
// @Success 200 {object} response.APIResponse
// @Router /apps/{appId}/tenant-settings [put]
func (t *TenantController) UpdateSettings(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}
	var req UpdateTenantSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}
	app, before, err := t.tenantService.UpdateTenantSettings(uint(appID), req.TenantRegistration, req.TenantDailyQuota)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	c.Set("audit_before_data", before)
	c.Set("audit_after_data", gin.H{"tenant_registration": app.TenantRegistration, "tenant_daily_quota": app.TenantDailyQuota})
	response.Success(c, gin.H{"tenant_registration": app.TenantRegistration, "tenant_daily_quota": app.TenantDailyQuota})
}
