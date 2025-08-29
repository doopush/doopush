package controllers

import (
	"log"
	"net/http"
	"strconv"

	"github.com/doopush/doopush/api/internal/config"
	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// DeviceController 设备控制器
type DeviceController struct {
	deviceService *services.DeviceService
}

// NewDeviceController 创建设备控制器
func NewDeviceController() *DeviceController {
	return &DeviceController{
		deviceService: services.NewDeviceService(),
	}
}

// RegisterDeviceRequest 设备注册请求
type RegisterDeviceRequest struct {
	Token      string                   `json:"token" binding:"required" example:"device_token_here"`
	BundleID   string                   `json:"bundle_id" binding:"required" example:"com.example.app"`
	Platform   string                   `json:"platform" binding:"required,oneof=ios android" example:"ios"`
	Channel    string                   `json:"channel" binding:"required" example:"apns"`
	Brand      string                   `json:"brand" example:"Apple"`
	Model      string                   `json:"model" example:"iPhone 14"`
	SystemVer  string                   `json:"system_version" example:"17.0"`
	AppVersion string                   `json:"app_version" example:"1.0.0"`
	UserAgent  string                   `json:"user_agent" example:"MyApp/1.0.0 (iOS 17.0)"`
	Tags       []services.DeviceTagItem `json:"tags" example:"[{\"tag_name\":\"user_type\",\"tag_value\":\"vip\"},{\"tag_name\":\"version\",\"tag_value\":\"1.0\"}]"`
}

// DeviceListResponse 设备列表响应
type DeviceListResponse struct {
	Devices []interface{} `json:"devices"`
	Total   int64         `json:"total" example:"100"`
	Page    int           `json:"page" example:"1"`
	Size    int           `json:"size" example:"20"`
}

// GatewayConfig Gateway配置信息
type GatewayConfig struct {
	Host string `json:"host" example:"gateway.doopush.com"`
	Port int    `json:"port" example:"5003"`
	SSL  bool   `json:"ssl" example:"false"`
}

// DeviceRegistrationResponse 设备注册响应（包含Gateway配置）
type DeviceRegistrationResponse struct {
	Device  interface{}   `json:"device"`
	Gateway GatewayConfig `json:"gateway"`
}

// RegisterDevice 注册设备
// @Summary 注册设备
// @Description 注册设备以接收推送通知。需要验证API Key属于指定应用且bundle_id与应用包名匹配。可以在注册时同时设置设备标签。成功注册后返回设备信息和Gateway长连接配置
// @Tags 设备管理
// @Accept json
// @Produce json
// @Security ApiKeyAuth
// @Param appId path int true "应用ID"
// @Param request body RegisterDeviceRequest true "设备信息，必须包含bundle_id用于安全验证，可选包含tags数组进行标签绑定"
// @Success 201 {object} response.APIResponse{data=DeviceRegistrationResponse} "注册成功，包含设备信息和Gateway配置"
// @Failure 400 {object} response.APIResponse "请求参数错误"
// @Failure 401 {object} response.APIResponse "API密钥无效或与应用不匹配"
// @Failure 422 {object} response.APIResponse "Bundle ID与应用包名不匹配"
// @Router /apps/{appId}/devices [post]
func (d *DeviceController) RegisterDevice(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	var req RegisterDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	device, err := d.deviceService.RegisterDevice(
		uint(appID),
		req.Token,
		req.BundleID,
		req.Platform,
		req.Channel,
		req.Brand,
		req.Model,
		req.SystemVer,
		req.AppVersion,
		req.UserAgent,
	)
	if err != nil {
		response.Error(c, http.StatusUnprocessableEntity, err.Error())
		return
	}

	// 处理设备标签
	if len(req.Tags) > 0 {
		err := d.deviceService.UpdateDeviceTags(uint(appID), req.Token, req.Tags)
		if err != nil {
			// 标签处理失败不应该影响设备注册，只记录日志
			log.Printf("设备注册成功但标签处理失败: %v", err)
		}
	}

	// 构建 Gateway 配置
	gatewayConfig := d.getGatewayConfig()

	// 构建包含 Gateway 配置的响应
	registrationResponse := DeviceRegistrationResponse{
		Device:  device,
		Gateway: gatewayConfig,
	}

	c.JSON(http.StatusCreated, response.APIResponse{
		Code:    201,
		Message: "设备注册成功",
		Data:    registrationResponse,
	})
}

// GetDevices 获取设备列表
// @Summary 获取设备列表
// @Description 获取应用的设备列表
// @Tags 设备管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param page query int false "页码" default(1)
// @Param size query int false "每页数量" default(20)
// @Param platform query string false "平台筛选" Enums(ios,android)
// @Param status query string false "状态筛选" Enums(0,1)
// @Success 200 {object} response.APIResponse{data=DeviceListResponse}
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Router /apps/{appId}/devices [get]
func (d *DeviceController) GetDevices(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	// 获取查询参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	platform := c.Query("platform")
	status := c.Query("status")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	userID := c.GetUint("user_id")
	devices, total, err := d.deviceService.GetDevices(uint(appID), userID, page, pageSize, platform, status)
	if err != nil {
		if err.Error() == "无权限访问该应用" {
			response.Forbidden(c, err.Error())
		} else {
			response.InternalServerError(c, err.Error())
		}
		return
	}

	response.Success(c, DeviceListResponse{
		Devices: func() []interface{} {
			result := make([]interface{}, len(devices))
			for i, device := range devices {
				result[i] = device
			}
			return result
		}(),
		Total: total,
		Page:  page,
		Size:  pageSize,
	})
}

// GetDevice 获取设备详情
// @Summary 获取设备详情
// @Description 根据设备ID获取设备详细信息
// @Tags 设备管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param deviceId path int true "设备ID"
// @Success 200 {object} response.APIResponse{data=models.Device}
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /apps/{appId}/devices/{deviceId} [get]
func (d *DeviceController) GetDevice(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("deviceId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的设备ID")
		return
	}

	userID := c.GetUint("user_id")
	device, err := d.deviceService.GetDeviceByID(uint(deviceID), userID)
	if err != nil {
		if err.Error() == "无权限访问该设备" {
			response.Forbidden(c, err.Error())
		} else {
			response.NotFound(c, err.Error())
		}
		return
	}

	response.Success(c, device)
}

// UpdateDeviceStatus 更新设备状态
// @Summary 更新设备状态
// @Description 启用或禁用设备，支持通过设备ID（数字）或设备Token（字符串）操作
// @Tags 设备管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param deviceId path string true "设备ID或设备Token"
// @Param request body map[string]int true "状态信息" example({"status":1})
// @Success 200 {object} response.APIResponse
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /apps/{appId}/devices/{deviceId}/status [put]
func (d *DeviceController) UpdateDeviceStatus(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	deviceParam := c.Param("deviceId")

	var req map[string]int
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	status, exists := req["status"]
	if !exists || (status != 0 && status != 1) {
		response.BadRequest(c, "状态值必须为0或1")
		return
	}

	userID := c.GetUint("user_id")

	// 尝试解析为数字ID
	if deviceID, err := strconv.ParseUint(deviceParam, 10, 32); err == nil {
		// 使用数字ID更新
		if err := d.deviceService.UpdateDeviceStatus(uint(deviceID), userID, status); err != nil {
			if err.Error() == "无权限修改该设备" {
				response.Forbidden(c, err.Error())
			} else {
				response.NotFound(c, err.Error())
			}
			return
		}
	} else {
		// 当作token处理
		if err := d.deviceService.UpdateDeviceStatusByToken(uint(appID), deviceParam, userID, status); err != nil {
			if err.Error() == "无权限修改该设备" {
				response.Forbidden(c, err.Error())
			} else {
				response.NotFound(c, err.Error())
			}
			return
		}
	}

	response.Success(c, gin.H{"message": "设备状态更新成功"})
}

// DeleteDevice 删除设备
// @Summary 删除设备
// @Description 删除设备记录，支持通过设备ID（数字）或设备Token（字符串）操作
// @Tags 设备管理
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param appId path int true "应用ID"
// @Param deviceId path string true "设备ID或设备Token"
// @Success 200 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /apps/{appId}/devices/{deviceId} [delete]
func (d *DeviceController) DeleteDevice(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("appId"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的应用ID")
		return
	}

	deviceParam := c.Param("deviceId")
	userID := c.GetUint("user_id")

	// 尝试解析为数字ID
	if deviceID, err := strconv.ParseUint(deviceParam, 10, 32); err == nil {
		// 使用数字ID删除
		if err := d.deviceService.DeleteDevice(uint(deviceID), userID); err != nil {
			if err.Error() == "无权限删除该设备" {
				response.Forbidden(c, err.Error())
			} else {
				response.NotFound(c, err.Error())
			}
			return
		}
	} else {
		// 当作token处理
		if err := d.deviceService.DeleteDeviceByToken(uint(appID), deviceParam, userID); err != nil {
			if err.Error() == "无权限删除该设备" {
				response.Forbidden(c, err.Error())
			} else {
				response.NotFound(c, err.Error())
			}
			return
		}
	}

	response.Success(c, gin.H{"message": "设备删除成功"})
}

// getGatewayConfig 获取Gateway配置信息
func (d *DeviceController) getGatewayConfig() GatewayConfig {
	// 从环境变量获取 Gateway 配置，如果没有配置则使用默认值
	host := config.GetString("GATEWAY_HOST", "localhost")
	port := config.GetInt("GATEWAY_PORT", 5003)
	ssl := config.GetBool("GATEWAY_SSL", false)

	return GatewayConfig{
		Host: host,
		Port: port,
		SSL:  ssl,
	}
}
