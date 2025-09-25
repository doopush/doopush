package controllers

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// CallbackController 消息回执控制器
type CallbackController struct {
	callbackService *services.CallbackService
}

// NewCallbackController 创建消息回执控制器
func NewCallbackController() *CallbackController {
	return &CallbackController{
		callbackService: services.NewCallbackService(),
	}
}

// ReceiveHuaweiCallback 接收华为推送回执
// @Summary 接收华为推送回执
// @Description 接收华为推送服务的消息回执通知
// @Tags 消息回执
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param Callback body HuaweiCallbackData true "华为回执数据"
// @Success 200 {object} response.APIResponse{data=CallbackProcessResult}
// @Failure 400 {object} response.APIResponse
// @Router /apps/callback/huawei [post]
func (r *CallbackController) ReceiveHuaweiCallback(c *gin.Context) {
	// 解析华为回执数据
	var callback interface{}
	if err := c.ShouldBindJSON(&callback); err != nil {
		response.Csuccess(c, "0")
		return
	}
	messageJSON, _ := json.Marshal(callback)
	fmt.Printf("接收的消息:----->%s", messageJSON)
	// 使用新的服务处理回执数据
	if err := r.callbackService.ProcessHuaweiCallback(callback); err != nil {
		response.Csuccess(c, "0")
		return
	}

	response.Csuccess(c, "0")
}

// ReceiveHonorCallback 接收荣耀推送回执
// @Summary 接收荣耀推送回执
// @Description 接收荣耀推送服务的消息回执通知
// @Tags 消息回执
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param Callback body HonorCallbackData true "荣耀回执数据"
// @Success 200 {object} response.APIResponse{data=CallbackProcessResult}
// @Failure 400 {object} response.APIResponse
// @Router /apps/callback/honor [post]
func (r *CallbackController) ReceiveHonorCallback(c *gin.Context) {
	// 解析荣耀回执数据
	var callback interface{}
	if err := c.ShouldBindJSON(&callback); err != nil {
		response.Csuccess(c, "0")
		return
	}

	// 使用新的服务处理回执数据
	if err := r.callbackService.ProcessHonorCallback(callback); err != nil {
		response.Csuccess(c, "0")
		return
	}

	response.Csuccess(c, "0")
}

// ReceiveOppoCallback 接收OPPO推送回执
// @Summary 接收OPPO推送回执
// @Description 接收OPPO推送服务的消息回执通知
// @Tags 消息回执
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param Callback body []OppoCallbackData true "OPPO回执数据"
// @Success 200 {object} response.APIResponse{data=CallbackProcessResult}
// @Failure 400 {object} response.APIResponse
// @Router /apps/callback/oppo [post]
func (r *CallbackController) ReceiveOppoCallback(c *gin.Context) {
	// 解析OPPO回执数据
	var callbacks []interface{}
	if err := c.ShouldBindJSON(&callbacks); err != nil {
		response.Csuccess(c, "0")
		return
	}

	// 使用新的服务处理回执数据
	if err := r.callbackService.ProcessOppoCallback(callbacks); err != nil {
		response.Csuccess(c, "0")
		return
	}

	response.Csuccess(c, "0")
}

// ReceiveVivoCallback 接收VIVO推送回执
// @Summary 接收VIVO推送回执
// @Description 接收VIVO推送服务的消息回执通知
// @Tags 消息回执
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param Callback body VivoCallbackRequest true "VIVO回执数据"
// @Success 200 {object} response.APIResponse{data=CallbackProcessResult}
// @Failure 400 {object} response.APIResponse
// @Router /apps/callback/vivo [post]
func (r *CallbackController) ReceiveVivoCallback(c *gin.Context) {
	// 解析VIVO回执数据
	var callback map[string]interface{}
	if err := c.ShouldBindJSON(&callback); err != nil {
		response.Csuccess(c, "0")
		return
	}

	// 使用新的服务处理回执数据
	if err := r.callbackService.ProcessVivoCallback(callback); err != nil {
		response.Csuccess(c, "0")
		return
	}

	response.Csuccess(c, "0")
}

// ReceiveXiaomiCallback 接收小米推送回执
// @Summary 接收小米推送回执
// @Description 接收小米推送服务的消息回执通知
// @Tags 消息回执
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param Callback body XiaomiCallbackRequest true "小米回执数据"
// @Success 200 {object} response.APIResponse{data=CallbackProcessResult}
// @Failure 400 {object} response.APIResponse
// @Router /apps/callback/xiaomi [post]
func (r *CallbackController) ReceiveXiaomiCallback(c *gin.Context) {
	// 解析小米回执数据
	var callback map[string]interface{}
	if err := c.ShouldBindJSON(&callback); err != nil {
		response.Csuccess(c, "0")
		return
	}
	messageJSON, _ := json.Marshal(callback)
	fmt.Printf("接收的消息:----->%s", messageJSON)
	// 使用新的服务处理回执数据
	if err := r.callbackService.ProcessXiaomiCallback(callback); err != nil {
		response.Csuccess(c, "0")
		return
	}

	response.Csuccess(c, "0")
}

// ReceiveMeizuCallback 接收魅族推送回执
// @Summary 接收魅族推送回执
// @Description 接收魅族推送服务的消息回执通知
// @Tags 消息回执
// @Accept json
// @Produce json
// @Param Callback body MeizuCallbackRequest true "魅族回执数据"
// @Success 200 {object} response.APIResponse{data=CallbackProcessResult}
// @Failure 400 {object} response.APIResponse
// @Router /apps/callback/meizu [post]
func (r *CallbackController) ReceiveMeizuCallback(c *gin.Context) {
	// 解析魅族回执数据
	var callback map[string]interface{}
	if err := c.ShouldBindJSON(&callback); err != nil {
		response.Csuccess(c, "0")
		return
	}

	// 使用新的服务处理回执数据
	if err := r.callbackService.ProcessMeizuCallback(callback); err != nil {
		response.Csuccess(c, "0")
		return
	}

	response.Csuccess(c, "0")
}

// ReceiveGenericCallback 接收通用格式回执
// @Summary 接收通用格式回执
// @Description 接收通用格式的推送回执，自动识别厂商类型
// @Tags 消息回执
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param vendor query string false "厂商类型" Enums(huawei,honor,oppo,vivo,xiaomi)
// @Param Callback body interface{} true "回执数据"
// @Success 200 {object} response.APIResponse{data=CallbackProcessResult}
// @Failure 400 {object} response.APIResponse
// @Router /apps/callback [post]
func (r *CallbackController) ReceiveGenericCallback(c *gin.Context) {

	vendor := c.Query("vendor")
	if vendor == "" {
		response.BadRequest(c, "请指定厂商类型")
		return
	}

	// 读取原始JSON数据
	var rawData json.RawMessage
	if err := c.ShouldBindJSON(&rawData); err != nil {
		response.BadRequest(c, "回执数据格式错误: "+err.Error())
		return
	}

	// 根据厂商类型解析和处理数据
	switch strings.ToLower(vendor) {
	case "huawei":
		var callback interface{}
		if err := json.Unmarshal(rawData, &callback); err != nil {
			response.BadRequest(c, "华为回执数据解析失败: "+err.Error())
			return
		}
		if err := r.callbackService.ProcessHuaweiCallback(callback); err != nil {
			response.BadRequest(c, "处理华为回执失败: "+err.Error())
			return
		}

	case "honor":
		var callback interface{}
		if err := json.Unmarshal(rawData, &callback); err != nil {
			response.BadRequest(c, "荣耀回执数据解析失败: "+err.Error())
			return
		}
		if err := r.callbackService.ProcessHonorCallback(callback); err != nil {
			response.BadRequest(c, "处理荣耀回执失败: "+err.Error())
			return
		}

	case "oppo":
		var callbacks []interface{}
		if err := json.Unmarshal(rawData, &callbacks); err != nil {
			response.BadRequest(c, "OPPO回执数据解析失败: "+err.Error())
			return
		}
		if err := r.callbackService.ProcessOppoCallback(callbacks); err != nil {
			response.BadRequest(c, "处理OPPO回执失败: "+err.Error())
			return
		}

	case "vivo":
		var callback map[string]interface{}
		if err := json.Unmarshal(rawData, &callback); err != nil {
			response.BadRequest(c, "VIVO回执数据解析失败: "+err.Error())
			return
		}
		if err := r.callbackService.ProcessVivoCallback(callback); err != nil {
			response.BadRequest(c, "处理VIVO回执失败: "+err.Error())
			return
		}

	case "xiaomi":
		var callback map[string]interface{}
		if err := json.Unmarshal(rawData, &callback); err != nil {
			response.BadRequest(c, "小米回执数据解析失败: "+err.Error())
			return
		}
		if err := r.callbackService.ProcessXiaomiCallback(callback); err != nil {
			response.BadRequest(c, "处理小米回执失败: "+err.Error())
			return
		}

	case "meizu":
		var callback map[string]interface{}
		if err := json.Unmarshal(rawData, &callback); err != nil {
			response.BadRequest(c, "魅族回执数据解析失败: "+err.Error())
			return
		}
		if err := r.callbackService.ProcessMeizuCallback(callback); err != nil {
			response.BadRequest(c, "处理魅族回执失败: "+err.Error())
			return
		}

	default:
		response.BadRequest(c, "不支持的厂商类型: "+vendor)
		return
	}

	response.Csuccess(c, "0")
}
