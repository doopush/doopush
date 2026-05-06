package controllers

import (
	"encoding/json"
	"strings"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/logger"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// CallbackController 消息回执控制器
type CallbackController struct {
	callbackService *services.CallbackService
	handlers        map[string]vendorCallbackHandler
}

// vendorCallbackHandler 解析厂商回执原始 JSON 并调用对应处理函数。
type vendorCallbackHandler func(*services.CallbackService, json.RawMessage) error

// 各厂商对回执 body 的反序列化形态不同（对象 / 数组 / map），所以解析逻辑随各厂商定义。
var defaultVendorHandlers = map[string]vendorCallbackHandler{
	"huawei": func(s *services.CallbackService, raw json.RawMessage) error {
		var v interface{}
		if err := json.Unmarshal(raw, &v); err != nil {
			return err
		}
		return s.ProcessHuaweiCallback(v)
	},
	"honor": func(s *services.CallbackService, raw json.RawMessage) error {
		var v interface{}
		if err := json.Unmarshal(raw, &v); err != nil {
			return err
		}
		return s.ProcessHonorCallback(v)
	},
	"oppo": func(s *services.CallbackService, raw json.RawMessage) error {
		var v []interface{}
		if err := json.Unmarshal(raw, &v); err != nil {
			return err
		}
		return s.ProcessOppoCallback(v)
	},
	"vivo": func(s *services.CallbackService, raw json.RawMessage) error {
		var v map[string]interface{}
		if err := json.Unmarshal(raw, &v); err != nil {
			return err
		}
		return s.ProcessVivoCallback(v)
	},
	"xiaomi": func(s *services.CallbackService, raw json.RawMessage) error {
		var v map[string]interface{}
		if err := json.Unmarshal(raw, &v); err != nil {
			return err
		}
		return s.ProcessXiaomiCallback(v)
	},
	"meizu": func(s *services.CallbackService, raw json.RawMessage) error {
		var v map[string]interface{}
		if err := json.Unmarshal(raw, &v); err != nil {
			return err
		}
		return s.ProcessMeizuCallback(v)
	},
}

// NewCallbackController 创建消息回执控制器
func NewCallbackController() *CallbackController {
	return &CallbackController{
		callbackService: services.NewCallbackService(),
		handlers:        defaultVendorHandlers,
	}
}

// processVendorCallback 通用入口：读取原始 body 并交给指定厂商处理函数。
// 厂商回执对失败容忍度高，错误一律记录日志后返回 ack（"0"），避免厂商重试风暴。
func (r *CallbackController) processVendorCallback(c *gin.Context, vendor string) {
	handler, ok := r.handlers[vendor]
	if !ok {
		response.BadRequest(c, "不支持的厂商类型: "+vendor)
		return
	}
	var raw json.RawMessage
	if err := c.ShouldBindJSON(&raw); err != nil {
		logger.Error("回执 body 解析失败", vendor, err)
		response.Csuccess(c, "0")
		return
	}
	if err := handler(r.callbackService, raw); err != nil {
		logger.Error("处理回执失败", vendor, err)
		response.Csuccess(c, "0")
		return
	}
	response.Csuccess(c, "0")
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
	r.processVendorCallback(c, "huawei")
}

// ReceiveHonorCallback 接收荣耀推送回执
// @Router /apps/callback/honor [post]
func (r *CallbackController) ReceiveHonorCallback(c *gin.Context) {
	r.processVendorCallback(c, "honor")
}

// ReceiveOppoCallback 接收OPPO推送回执
// @Router /apps/callback/oppo [post]
func (r *CallbackController) ReceiveOppoCallback(c *gin.Context) {
	r.processVendorCallback(c, "oppo")
}

// ReceiveVivoCallback 接收VIVO推送回执
// @Router /apps/callback/vivo [post]
func (r *CallbackController) ReceiveVivoCallback(c *gin.Context) {
	r.processVendorCallback(c, "vivo")
}

// ReceiveXiaomiCallback 接收小米推送回执
// @Router /apps/callback/xiaomi [post]
func (r *CallbackController) ReceiveXiaomiCallback(c *gin.Context) {
	r.processVendorCallback(c, "xiaomi")
}

// ReceiveMeizuCallback 接收魅族推送回执
// @Router /apps/callback/meizu [post]
func (r *CallbackController) ReceiveMeizuCallback(c *gin.Context) {
	r.processVendorCallback(c, "meizu")
}

// ReceiveGenericCallback 接收通用格式回执
// @Summary 接收通用格式回执
// @Description 接收通用格式的推送回执，自动识别厂商类型
// @Tags 消息回执
// @Accept json
// @Produce json
// @Param appId path int true "应用ID"
// @Param vendor query string false "厂商类型" Enums(huawei,honor,oppo,vivo,xiaomi,meizu)
// @Param Callback body interface{} true "回执数据"
// @Success 200 {object} response.APIResponse{data=CallbackProcessResult}
// @Failure 400 {object} response.APIResponse
// @Router /apps/callback [post]
func (r *CallbackController) ReceiveGenericCallback(c *gin.Context) {
	vendor := strings.ToLower(c.Query("vendor"))
	if vendor == "" {
		response.BadRequest(c, "请指定厂商类型")
		return
	}
	handler, ok := r.handlers[vendor]
	if !ok {
		response.BadRequest(c, "不支持的厂商类型: "+vendor)
		return
	}
	var raw json.RawMessage
	if err := c.ShouldBindJSON(&raw); err != nil {
		response.BadRequest(c, "回执数据格式错误: "+err.Error())
		return
	}
	if err := handler(r.callbackService, raw); err != nil {
		response.BadRequest(c, "处理"+vendor+"回执失败: "+err.Error())
		return
	}
	response.Csuccess(c, "0")
}
