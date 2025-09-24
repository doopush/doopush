package controllers

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// CallbackController 消息回执控制器
type CallbackController struct{}

// NewCallbackController 创建消息回执控制器
func NewCallbackController() *CallbackController {
	return &CallbackController{}
}

// 华为推送回执数据结构 - 根据实际格式更新
type HuaweiCallbackData struct {
	ValidateOnly bool                  `json:"validate_only"`
	Message      HuaweiCallbackMessage `json:"message"`
}

type HuaweiCallbackMessage struct {
	Notification HuaweiNotification `json:"notification"`
	Android      HuaweiAndroid      `json:"android"`
	Token        []string           `json:"token"`
}

type HuaweiNotification struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

type HuaweiAndroid struct {
	BiTag        string                    `json:"bi_tag"`
	Notification HuaweiAndroidNotification `json:"notification"`
}

type HuaweiAndroidNotification struct {
	ClickAction HuaweiClickAction `json:"click_action"`
}

type HuaweiClickAction struct {
	Type int `json:"type"`
}

// 荣耀推送回执数据结构 - 根据实际格式更新
type HonorCallbackData struct {
	Statuses []HonorCallbackStatus `json:"statuses"`
}

type HonorCallbackStatus struct {
	BiTag     string `json:"biTag"`     // 业务标识
	AppID     string `json:"appid"`     // 应用ID
	Token     string `json:"token"`     // 设备token
	Status    int    `json:"status"`    // 状态码
	Timestamp int64  `json:"timestamp"` // 时间戳
	RequestID string `json:"requestId"` // 请求ID
}

// OPPO推送回执数据结构 - 根据实际格式更新
type OppoCallbackData struct {
	MessageID       string `json:"messageId"`       // 到达的消息ID
	AppID           string `json:"appId"`           // 对应的应用ID
	TaskID          string `json:"taskId"`          // 如果是广播消息，对应taskID；如果是单推消息，该字段为消息ID
	RegistrationIDs string `json:"registrationIds"` // 消息的推送目标注册ID
	EventTime       string `json:"eventTime"`       // 回执事件产生时间
	Param           string `json:"param"`           // 开发者指定的回执参数
	EventType       string `json:"eventType"`       // 事件类型：push_arrive/regid_invalid/user_daily_limit
}

// VIVO推送回执数据结构 - 根据实际格式更新
type VivoCallbackRequest map[string]VivoCallbackData

type VivoCallbackData struct {
	Targets string `json:"targets"` // 对应单推请求体中的regId
	AckTime int64  `json:"ackTime"` // 回执毫秒时间戳
	Param   string `json:"param"`   // 对应单推请求体中的callback.param
	AckType string `json:"ackType"` // 到达回执ackType
}

// 小米推送回执数据结构 - 根据实际格式更新
type XiaomiCallbackRequest map[string]XiaomiCallbackData

type XiaomiCallbackData struct {
	Param     string `json:"param"`     // 回调参数
	Type      int    `json:"type"`      // 类型：1-送达，2-点击，16-无效设备
	Targets   string `json:"targets"`   // 目标设备列表
	JobKey    string `json:"jobkey"`    // 任务key
	BarStatus string `json:"barStatus"` // 状态栏状态
	Timestamp int64  `json:"timestamp"` // 时间戳
}

// 魅族推送回执数据结构 - 根据实际格式更新
type MeizuCallbackRequest map[string]MeizuCallbackData

type MeizuCallbackData struct {
	Param   string   `json:"param"`   // 回调参数
	Type    int      `json:"type"`    // 类型：1-送达，2-点击
	Targets []string `json:"targets"` // 目标设备列表（数组格式）
}

// 通用回执处理结果
type CallbackProcessResult struct {
	Vendor      string `json:"vendor"`       // 厂商名称
	ProcessedAt int64  `json:"processed_at"` // 处理时间戳
	Success     bool   `json:"success"`      // 处理是否成功
	Message     string `json:"message"`      // 处理结果消息
	Count       int    `json:"count"`        // 处理的回执数量
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
	var callback HuaweiCallbackData
	if err := c.ShouldBindJSON(&callback); err != nil {
		response.BadRequest(c, "华为回执数据格式错误: "+err.Error())
		return
	}

	// 处理回执数据
	r.processHuaweiCallback(callback)
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
	var callback HonorCallbackData
	if err := c.ShouldBindJSON(&callback); err != nil {
		response.BadRequest(c, "荣耀回执数据格式错误: "+err.Error())
		return
	}

	// 处理回执数据
	r.processHonorCallback(callback)

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
	var callbacks []OppoCallbackData
	if err := c.ShouldBindJSON(&callbacks); err != nil {
		response.BadRequest(c, "OPPO回执数据格式错误: "+err.Error())
		return
	}

	// 处理回执数据
	r.processOppoCallbacks(callbacks)

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
	var callback VivoCallbackRequest
	if err := c.ShouldBindJSON(&callback); err != nil {
		response.BadRequest(c, "VIVO回执数据格式错误: "+err.Error())
		return
	}

	// 处理回执数据
	r.processVivoCallback(callback)

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
	var callback XiaomiCallbackRequest
	if err := c.ShouldBindJSON(&callback); err != nil {
		response.BadRequest(c, "小米回执数据格式错误: "+err.Error())
		return
	}

	// 处理回执数据
	r.processXiaomiCallback(callback)

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
	var callback MeizuCallbackRequest
	if err := c.ShouldBindJSON(&callback); err != nil {
		response.BadRequest(c, "魅族回执数据格式错误: "+err.Error())
		return
	}

	// 处理回执数据
	r.processMeizuCallback(callback)

	response.Csuccess(c, "0")
}

// processHuaweiCallback 处理华为推送回执
func (r *CallbackController) processHuaweiCallback(callback HuaweiCallbackData) CallbackProcessResult {
	result := CallbackProcessResult{
		Vendor:      "huawei",
		ProcessedAt: time.Now().Unix(),
		Success:     true,
		Count:       0,
	}

	successCount := 0
	errorCount := 0

	// 华为回执主要包含消息结构信息，这里简单处理
	if len(callback.Message.Token) > 0 {
		for _, token := range callback.Message.Token {
			// 华为回执成功处理
			if r.processCallbackByToken("huawei", token, callback.Message.Android.BiTag, 1, true, time.Now().Unix()*1000) {
				successCount++
			} else {
				errorCount++
			}
		}
	}

	result.Count = successCount + errorCount
	if errorCount > 0 {
		result.Success = false
		result.Message = fmt.Sprintf("处理完成，成功: %d, 失败: %d", successCount, errorCount)
	} else {
		result.Message = fmt.Sprintf("成功处理 %d 条华为回执", successCount)
	}

	return result
}

// processHonorCallback 处理荣耀推送回执
func (r *CallbackController) processHonorCallback(callback HonorCallbackData) CallbackProcessResult {
	result := CallbackProcessResult{
		Vendor:      "honor",
		ProcessedAt: time.Now().Unix(),
		Success:     true,
		Count:       0,
	}

	successCount := 0
	errorCount := 0

	for _, status := range callback.Statuses {
		// 荣耀回执：status为40000002表示成功
		success := status.Status == 40000002
		if r.processCallbackByToken("honor", status.Token, status.BiTag, 1, success, status.Timestamp) {
			successCount++
		} else {
			errorCount++
		}
	}

	result.Count = successCount + errorCount
	if errorCount > 0 {
		result.Success = false
		result.Message = fmt.Sprintf("处理完成，成功: %d, 失败: %d", successCount, errorCount)
	} else {
		result.Message = fmt.Sprintf("成功处理 %d 条荣耀回执", successCount)
	}

	return result
}

// processOppoCallbacks 处理OPPO推送回执
func (r *CallbackController) processOppoCallbacks(callbacks []OppoCallbackData) CallbackProcessResult {
	result := CallbackProcessResult{
		Vendor:      "oppo",
		ProcessedAt: time.Now().Unix(),
		Success:     true,
		Count:       0,
	}

	successCount := 0
	errorCount := 0

	for _, callback := range callbacks {
		// 解析事件时间
		timestamp := time.Now().Unix() * 1000
		if callback.EventTime != "" {
			if t, err := strconv.ParseInt(callback.EventTime, 10, 64); err == nil {
				timestamp = t
			}
		}

		// 解析事件类型
		eventType := 1 // 默认为送达
		if callback.EventType == "push_arrive" {
			eventType = 1
		}

		// 处理多个注册ID
		regIDs := strings.Split(callback.RegistrationIDs, ",")
		for _, regID := range regIDs {
			regID = strings.TrimSpace(regID)
			if regID != "" {
				if r.processCallbackByToken("oppo", regID, callback.MessageID, eventType, true, timestamp) {
					successCount++
				} else {
					errorCount++
				}
			}
		}
	}

	result.Count = successCount + errorCount
	if errorCount > 0 {
		result.Success = false
		result.Message = fmt.Sprintf("处理完成，成功: %d, 失败: %d", successCount, errorCount)
	} else {
		result.Message = fmt.Sprintf("成功处理 %d 条OPPO回执", successCount)
	}

	return result
}

// processVivoCallback 处理VIVO推送回执
func (r *CallbackController) processVivoCallback(callback VivoCallbackRequest) CallbackProcessResult {
	result := CallbackProcessResult{
		Vendor:      "vivo",
		ProcessedAt: time.Now().Unix(),
		Success:     true,
		Count:       0,
	}

	successCount := 0
	errorCount := 0

	for taskID, data := range callback {
		// VIVO回执：ackType为"0"表示到达回执
		success := data.AckType == "0"
		eventType := 1 // 到达事件

		if r.processCallbackByToken("vivo", data.Targets, taskID, eventType, success, data.AckTime) {
			successCount++
		} else {
			errorCount++
		}
	}

	result.Count = successCount + errorCount
	if errorCount > 0 {
		result.Success = false
		result.Message = fmt.Sprintf("处理完成，成功: %d, 失败: %d", successCount, errorCount)
	} else {
		result.Message = fmt.Sprintf("成功处理 %d 条VIVO回执", successCount)
	}

	return result
}

// processXiaomiCallback 处理小米推送回执
func (r *CallbackController) processXiaomiCallback(callback XiaomiCallbackRequest) CallbackProcessResult {
	result := CallbackProcessResult{
		Vendor:      "xiaomi",
		ProcessedAt: time.Now().Unix(),
		Success:     true,
		Count:       0,
	}

	successCount := 0
	errorCount := 0

	for msgID, data := range callback {
		// 小米回执：type=1送达，type=2点击，type=16无效设备
		success := data.Type != 16
		eventType := data.Type

		// 处理多个目标设备
		targets := strings.Split(data.Targets, ",")
		for _, target := range targets {
			target = strings.TrimSpace(target)
			if target != "" {
				if r.processCallbackByToken("xiaomi", target, msgID, eventType, success, data.Timestamp) {
					successCount++
				} else {
					errorCount++
				}
			}
		}
	}

	result.Count = successCount + errorCount
	if errorCount > 0 {
		result.Success = false
		result.Message = fmt.Sprintf("处理完成，成功: %d, 失败: %d", successCount, errorCount)
	} else {
		result.Message = fmt.Sprintf("成功处理 %d 条小米回执", successCount)
	}

	return result
}

// processMeizuCallback 处理魅族推送回执
func (r *CallbackController) processMeizuCallback(callback MeizuCallbackRequest) CallbackProcessResult {
	result := CallbackProcessResult{
		Vendor:      "meizu",
		ProcessedAt: time.Now().Unix(),
		Success:     true,
		Count:       0,
	}

	successCount := 0
	errorCount := 0

	for msgID, data := range callback {
		// 魅族回执：type=1送达，type=2点击
		success := true // 魅族回执默认成功
		eventType := data.Type

		// 处理多个目标设备（数组格式）
		for _, target := range data.Targets {
			target = strings.TrimSpace(target)
			if target != "" {
				if r.processCallbackByToken("meizu", target, msgID, eventType, success, time.Now().Unix()*1000) {
					successCount++
				} else {
					errorCount++
				}
			}
		}
	}

	result.Count = successCount + errorCount
	if errorCount > 0 {
		result.Success = false
		result.Message = fmt.Sprintf("处理完成，成功: %d, 失败: %d", successCount, errorCount)
	} else {
		result.Message = fmt.Sprintf("成功处理 %d 条魅族回执", successCount)
	}

	return result
}

// processCallbackByToken 根据设备Token处理回执
func (r *CallbackController) processCallbackByToken(vendor, deviceToken, messageID string, eventType int, success bool, timestamp int64) bool {
	// 查找对应的设备
	var device models.Device
	if err := database.DB.Where("token = ? AND channel = ?", deviceToken, vendor).First(&device).Error; err != nil {
		// 设备不存在，记录日志但不返回错误
		fmt.Printf("设备不存在: vendor=%s, token=%s\n", vendor, deviceToken)
		return false
	}

	// 根据messageID或biTag查找推送日志
	var pushLog models.PushLog
	var found bool

	// 尝试通过push_log_id查找（如果messageID是数字）
	if pushLogID, err := strconv.ParseUint(messageID, 10, 32); err == nil {
		if err := database.DB.Where("id = ?  AND device_id = ?", pushLogID, device.ID).First(&pushLog).Error; err == nil {
			found = true
		}
	}

	// 如果没找到，尝试通过biTag或dedup_key查找
	if !found && messageID != "" {
		if err := database.DB.Where("(dedup_key = ? OR channel = ?)  AND device_id = ?", messageID, vendor, device.ID).First(&pushLog).Error; err == nil {
			found = true
		}
	}

	if !found {
		fmt.Printf("推送日志不存在: vendor=%s, messageID=%s, deviceID=%d\n", vendor, messageID, device.ID)
		return false
	}

	// 更新推送结果
	var pushResult models.PushResult
	if err := database.DB.Where("push_log_id = ?", pushLog.ID).First(&pushResult).Error; err != nil {
		// 如果推送结果不存在，创建一个新的
		pushResult = models.PushResult{
			PushLogID:    pushLog.ID,
			Success:      success,
			ResponseData: "{}",
		}
		if !success {
			pushResult.ErrorCode = "CALLBACK_FAILED"
			pushResult.ErrorMessage = fmt.Sprintf("%s推送回执显示失败", strings.ToUpper(vendor))
		}
		database.DB.Create(&pushResult)
	} else {
		// 更新现有的推送结果
		if !success {
			pushResult.Success = false
			pushResult.ErrorCode = "CALLBACK_FAILED"
			pushResult.ErrorMessage = fmt.Sprintf("%s推送回执显示失败", strings.ToUpper(vendor))
		}
		database.DB.Save(&pushResult)
	}

	// 更新推送统计
	// r.updatePushStatistics(eventType, timestamp)

	return true
}

// updatePushStatistics 更新推送统计数据
// func (r *CallbackController) updatePushStatistics(eventType int, timestamp int64) {
// 	// 将时间戳转换为日期
// 	eventTime := time.Unix(timestamp/1000, 0) // 假设时间戳是毫秒
// 	if timestamp < 1000000000000 {            // 如果时间戳小于这个值，可能是秒
// 		eventTime = time.Unix(timestamp, 0)
// 	}

// 	date := time.Date(eventTime.Year(), eventTime.Month(), eventTime.Day(), 0, 0, 0, 0, eventTime.Location())

// 	// 查找或创建统计记录
// 	var stat models.PushStatistics
// 	err := database.DB.Where("app_id = ? AND date = ?", appID, date).First(&stat).Error
// 	if err != nil {
// 		// 创建新的统计记录
// 		stat = models.PushStatistics{
// 			AppID:         appID,
// 			Date:          date,
// 			TotalPushes:   0,
// 			SuccessPushes: 0,
// 			FailedPushes:  0,
// 			ClickCount:    0,
// 			OpenCount:     0,
// 		}
// 	}

// 	// 根据事件类型更新统计
// 	switch eventType {
// 	case 1: // 送达/打开
// 		stat.OpenCount++
// 	case 2: // 点击
// 		stat.ClickCount++
// 	case 3: // 关闭（暂不处理）
// 		// 不更新统计
// 	}

// 	// 保存统计数据
// 	if stat.ID == 0 {
// 		database.DB.Create(&stat)
// 	} else {
// 		database.DB.Save(&stat)
// 	}
// }

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

	var result CallbackProcessResult

	// 根据厂商类型解析和处理数据
	switch strings.ToLower(vendor) {
	case "huawei":
		var callback HuaweiCallbackData
		if err := json.Unmarshal(rawData, &callback); err != nil {
			response.BadRequest(c, "华为回执数据解析失败: "+err.Error())
			return
		}
		result = r.processHuaweiCallback(callback)

	case "honor":
		var callback HonorCallbackData
		if err := json.Unmarshal(rawData, &callback); err != nil {
			response.BadRequest(c, "荣耀回执数据解析失败: "+err.Error())
			return
		}
		result = r.processHonorCallback(callback)

	case "oppo":
		var callbacks []OppoCallbackData
		if err := json.Unmarshal(rawData, &callbacks); err != nil {
			response.BadRequest(c, "OPPO回执数据解析失败: "+err.Error())
			return
		}
		result = r.processOppoCallbacks(callbacks)

	case "vivo":
		var callback VivoCallbackRequest
		if err := json.Unmarshal(rawData, &callback); err != nil {
			response.BadRequest(c, "VIVO回执数据解析失败: "+err.Error())
			return
		}
		result = r.processVivoCallback(callback)

	case "xiaomi":
		var callback XiaomiCallbackRequest
		if err := json.Unmarshal(rawData, &callback); err != nil {
			response.BadRequest(c, "小米回执数据解析失败: "+err.Error())
			return
		}
		result = r.processXiaomiCallback(callback)

	case "meizu":
		var callback MeizuCallbackRequest
		if err := json.Unmarshal(rawData, &callback); err != nil {
			response.BadRequest(c, "魅族回执数据解析失败: "+err.Error())
			return
		}
		result = r.processMeizuCallback(callback)

	default:
		response.BadRequest(c, "不支持的厂商类型: "+vendor)
		return
	}

	response.Success(c, result)
}
