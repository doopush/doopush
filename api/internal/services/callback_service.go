package services

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
)

// CallbackService 回执处理服务
type CallbackService struct{}

// NewCallbackService 创建回执处理服务
func NewCallbackService() *CallbackService {
	return &CallbackService{}
}

// ProcessHuaweiCallback 处理华为推送回执
func (s *CallbackService) ProcessHuaweiCallback(callback interface{}) error {
	data, ok := callback.(map[string]interface{})
	if !ok {
		return fmt.Errorf("华为回执数据格式错误")
	}

	// 解析消息数据
	message, ok := data["message"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("华为回执消息数据格式错误")
	}

	// 解析tokens
	tokens, ok := message["token"].([]interface{})
	if !ok {
		return fmt.Errorf("华为回执token数据格式错误")
	}

	// 解析Android数据
	android, _ := message["android"].(map[string]interface{})
	biTag := ""
	if android != nil {
		biTag, _ = android["bi_tag"].(string)
	}

	// 解析通知数据
	notification, _ := message["notification"].(map[string]interface{})
	title, _ := notification["title"].(string)
	body, _ := notification["body"].(string)

	// 原始数据
	rawData, _ := json.Marshal(data)

	// 处理每个token
	for _, tokenInterface := range tokens {
		token, ok := tokenInterface.(string)
		if !ok {
			continue
		}

		// 查找设备
		device, pushLog, err := s.findDeviceAndPushLog("huawei", token, biTag)
		if err != nil {
			continue
		}

		// 创建华为回执记录
		huaweiCallback := models.HuaweiCallback{
			BaseCallback: models.BaseCallback{
				AppID:       device.AppID,
				DeviceID:    device.ID,
				PushLogID:   pushLog.ID,
				MessageID:   biTag,
				DeviceToken: token,
				EventType:   1, // 送达事件
				Success:     true,
				Timestamp:   time.Now().Unix() * 1000,
				ProcessedAt: time.Now(),
			},
			BiTag:        biTag,
			ValidateOnly: data["validate_only"].(bool),
			Title:        title,
			Body:         body,
			RawData:      string(rawData),
		}

		// 保存到数据库
		if err := database.DB.Create(&huaweiCallback).Error; err != nil {
			fmt.Printf("保存华为回执失败: %v\n", err)
		}

		// 更新统计
		s.updateCallbackStatistics(device.AppID, "huawei", 1, true, 1, 0)
	}

	return nil
}

// ProcessHonorCallback 处理荣耀推送回执
func (s *CallbackService) ProcessHonorCallback(callback interface{}) error {
	data, ok := callback.(map[string]interface{})
	if !ok {
		return fmt.Errorf("荣耀回执数据格式错误")
	}

	statuses, ok := data["statuses"].([]interface{})
	if !ok {
		return fmt.Errorf("荣耀回执状态数据格式错误")
	}

	rawData, _ := json.Marshal(data)

	for _, statusInterface := range statuses {
		status, ok := statusInterface.(map[string]interface{})
		if !ok {
			continue
		}

		token, _ := status["token"].(string)
		biTag, _ := status["biTag"].(string)
		statusCode, _ := status["status"].(float64)
		timestamp, _ := status["timestamp"].(float64)
		requestID, _ := status["requestId"].(string)

		// 查找设备
		device, pushLog, err := s.findDeviceAndPushLog("honor", token, biTag)
		if err != nil {
			continue
		}

		// 荣耀回执：status为40000002表示成功
		success := int(statusCode) == 40000002

		// 创建荣耀回执记录
		honorCallback := models.HonorCallback{
			BaseCallback: models.BaseCallback{
				AppID:       device.AppID,
				DeviceID:    device.ID,
				PushLogID:   pushLog.ID,
				MessageID:   biTag,
				DeviceToken: token,
				EventType:   1,
				Success:     success,
				Timestamp:   int64(timestamp),
				ProcessedAt: time.Now(),
			},
			BiTag:     biTag,
			Status:    int(statusCode),
			RequestID: requestID,
			RawData:   string(rawData),
		}

		// 保存到数据库
		if err := database.DB.Create(&honorCallback).Error; err != nil {
			fmt.Printf("保存荣耀回执失败: %v\n", err)
		}

		// 更新统计
		successCount := 0
		if success {
			successCount = 1
		}
		s.updateCallbackStatistics(device.AppID, "honor", 1, success, successCount, 0)
	}

	return nil
}

// ProcessOppoCallback 处理OPPO推送回执
func (s *CallbackService) ProcessOppoCallback(callbacks []interface{}) error {
	for _, callbackInterface := range callbacks {
		data, ok := callbackInterface.(map[string]interface{})
		if !ok {
			continue
		}

		messageID, _ := data["messageId"].(string)
		taskID, _ := data["taskId"].(string)
		registrationIDs, _ := data["registrationIds"].(string)
		eventTime, _ := data["eventTime"].(string)
		param, _ := data["param"].(string)
		eventType, _ := data["eventType"].(string)

		rawData, _ := json.Marshal(data)

		// 解析事件时间
		timestamp := time.Now().Unix() * 1000
		if eventTime != "" {
			if t, err := strconv.ParseInt(eventTime, 10, 64); err == nil {
				timestamp = t
			}
		}

		// 解析事件类型
		eventTypeCode := 1 // 默认为送达
		if eventType == "push_arrive" {
			eventTypeCode = 1
		}

		// 处理多个注册ID
		regIDs := strings.Split(registrationIDs, ",")
		for _, regID := range regIDs {
			regID = strings.TrimSpace(regID)
			if regID == "" {
				continue
			}

			// 查找设备
			device, pushLog, err := s.findDeviceAndPushLog("oppo", regID, messageID)
			if err != nil {
				continue
			}

			// 创建OPPO回执记录
			oppoCallback := models.OppoCallback{
				BaseCallback: models.BaseCallback{
					AppID:       device.AppID,
					DeviceID:    device.ID,
					PushLogID:   pushLog.ID,
					MessageID:   messageID,
					DeviceToken: regID,
					EventType:   eventTypeCode,
					Success:     true,
					Timestamp:   timestamp,
					ProcessedAt: time.Now(),
				},
				TaskID:          taskID,
				RegistrationIDs: registrationIDs,
				EventTime:       eventTime,
				Param:           param,
				EventTypeName:   eventType,
				RawData:         string(rawData),
			}

			// 保存到数据库
			if err := database.DB.Create(&oppoCallback).Error; err != nil {
				fmt.Printf("保存OPPO回执失败: %v\n", err)
			}

			// 更新统计
			s.updateCallbackStatistics(device.AppID, "oppo", 1, true, 1, 0)
		}
	}

	return nil
}

// ProcessVivoCallback 处理VIVO推送回执
func (s *CallbackService) ProcessVivoCallback(callback map[string]interface{}) error {
	rawData, _ := json.Marshal(callback)

	for taskID, dataInterface := range callback {
		data, ok := dataInterface.(map[string]interface{})
		if !ok {
			continue
		}

		targets, _ := data["targets"].(string)
		ackTime, _ := data["ackTime"].(float64)
		param, _ := data["param"].(string)
		ackType, _ := data["ackType"].(string)

		// 查找设备
		device, pushLog, err := s.findDeviceAndPushLog("vivo", targets, taskID)
		if err != nil {
			continue
		}

		// VIVO回执：ackType为"0"表示到达回执
		success := ackType == "0"

		// 创建VIVO回执记录
		vivoCallback := models.VivoCallback{
			BaseCallback: models.BaseCallback{
				AppID:       device.AppID,
				DeviceID:    device.ID,
				PushLogID:   pushLog.ID,
				MessageID:   taskID,
				DeviceToken: targets,
				EventType:   1,
				Success:     success,
				Timestamp:   int64(ackTime),
				ProcessedAt: time.Now(),
			},
			TaskID:  taskID,
			Targets: targets,
			AckTime: int64(ackTime),
			Param:   param,
			AckType: ackType,
			RawData: string(rawData),
		}

		// 保存到数据库
		if err := database.DB.Create(&vivoCallback).Error; err != nil {
			fmt.Printf("保存VIVO回执失败: %v\n", err)
		}

		// 更新统计
		successCount := 0
		if success {
			successCount = 1
		}
		s.updateCallbackStatistics(device.AppID, "vivo", 1, success, successCount, 0)
	}

	return nil
}

// ProcessXiaomiCallback 处理小米推送回执
func (s *CallbackService) ProcessXiaomiCallback(callback map[string]interface{}) error {
	rawData, _ := json.Marshal(callback)

	for msgID, dataInterface := range callback {
		data, ok := dataInterface.(map[string]interface{})
		if !ok {
			continue
		}

		param, _ := data["param"].(string)
		typeCode, _ := data["type"].(float64)
		targets, _ := data["targets"].(string)
		jobKey, _ := data["jobkey"].(string)
		barStatus, _ := data["barStatus"].(string)
		timestamp, _ := data["timestamp"].(float64)

		// 小米回执：type=1送达，type=2点击，type=16无效设备
		success := int(typeCode) != 16
		eventType := int(typeCode)

		// 处理多个目标设备
		targetList := strings.Split(targets, ",")
		for _, target := range targetList {
			target = strings.TrimSpace(target)
			if target == "" {
				continue
			}

			// 查找设备
			device, pushLog, err := s.findDeviceAndPushLog("xiaomi", target, msgID)
			if err != nil {
				continue
			}

			// 创建小米回执记录
			xiaomiCallback := models.XiaomiCallback{
				BaseCallback: models.BaseCallback{
					AppID:       device.AppID,
					DeviceID:    device.ID,
					PushLogID:   pushLog.ID,
					MessageID:   msgID,
					DeviceToken: target,
					EventType:   eventType,
					Success:     success,
					Timestamp:   int64(timestamp),
					ProcessedAt: time.Now(),
				},
				JobKey:    jobKey,
				Targets:   targets,
				Param:     param,
				Type:      eventType,
				BarStatus: barStatus,
				RawData:   string(rawData),
			}

			// 保存到数据库
			if err := database.DB.Create(&xiaomiCallback).Error; err != nil {
				fmt.Printf("保存小米回执失败: %v\n", err)
			}

			// 更新统计
			successCount := 0
			clickCount := 0
			if success {
				successCount = 1
				if eventType == 2 {
					clickCount = 1
				}
			}
			s.updateCallbackStatistics(device.AppID, "xiaomi", 1, success, successCount, clickCount)
		}
	}

	return nil
}

// ProcessMeizuCallback 处理魅族推送回执
func (s *CallbackService) ProcessMeizuCallback(callback map[string]interface{}) error {
	rawData, _ := json.Marshal(callback)

	for msgID, dataInterface := range callback {
		data, ok := dataInterface.(map[string]interface{})
		if !ok {
			continue
		}

		param, _ := data["param"].(string)
		typeCode, _ := data["type"].(float64)
		targetsInterface, _ := data["targets"].([]interface{})

		eventType := int(typeCode)
		success := true // 魅族回执默认成功

		// 处理多个目标设备（数组格式）
		for _, targetInterface := range targetsInterface {
			target, ok := targetInterface.(string)
			if !ok {
				continue
			}

			target = strings.TrimSpace(target)
			if target == "" {
				continue
			}

			// 查找设备
			device, pushLog, err := s.findDeviceAndPushLog("meizu", target, msgID)
			if err != nil {
				continue
			}

			// 创建魅族回执记录
			meizuCallback := models.MeizuCallback{
				BaseCallback: models.BaseCallback{
					AppID:       device.AppID,
					DeviceID:    device.ID,
					PushLogID:   pushLog.ID,
					MessageID:   msgID,
					DeviceToken: target,
					EventType:   eventType,
					Success:     success,
					Timestamp:   time.Now().Unix() * 1000,
					ProcessedAt: time.Now(),
				},
				Param:   param,
				Type:    eventType,
				Targets: strings.Join([]string{target}, ","),
				RawData: string(rawData),
			}

			// 保存到数据库
			if err := database.DB.Create(&meizuCallback).Error; err != nil {
				fmt.Printf("保存魅族回执失败: %v\n", err)
			}

			// 更新统计
			clickCount := 0
			if eventType == 2 {
				clickCount = 1
			}
			s.updateCallbackStatistics(device.AppID, "meizu", 1, success, 1, clickCount)
		}
	}

	return nil
}

// findDeviceAndPushLog 查找设备和推送日志
func (s *CallbackService) findDeviceAndPushLog(vendor, deviceToken, messageID string) (*models.Device, *models.PushLog, error) {
	// 查找对应的设备
	var device models.Device
	if err := database.DB.Where("token = ? AND channel = ?", deviceToken, vendor).First(&device).Error; err != nil {
		return nil, nil, fmt.Errorf("设备不存在: vendor=%s, token=%s", vendor, deviceToken)
	}

	// 根据messageID或biTag查找推送日志
	var pushLog models.PushLog
	var found bool

	// 尝试通过push_log_id查找（如果messageID是数字）
	if pushLogID, err := strconv.ParseUint(messageID, 10, 32); err == nil {
		if err := database.DB.Where("id = ? AND device_id = ?", pushLogID, device.ID).First(&pushLog).Error; err == nil {
			found = true
		}
	}

	// 如果没找到，尝试通过dedup_key查找
	if !found && messageID != "" {
		if err := database.DB.Where("dedup_key = ? AND device_id = ?", messageID, device.ID).First(&pushLog).Error; err == nil {
			found = true
		}
	}

	// 如果还没找到，尝试通过最近的推送日志
	if !found {
		if err := database.DB.Where("device_id = ? AND channel = ?", device.ID, vendor).Order("created_at DESC").First(&pushLog).Error; err == nil {
			found = true
		}
	}

	if !found {
		return nil, nil, fmt.Errorf("推送日志不存在: vendor=%s, messageID=%s, deviceID=%d", vendor, messageID, device.ID)
	}

	return &device, &pushLog, nil
}

// updateCallbackStatistics 更新回执统计
func (s *CallbackService) updateCallbackStatistics(appID uint, vendor string, totalCount int, success bool, deliveryCount, clickCount int) {
	today := time.Now().Truncate(24 * time.Hour)

	// 查找或创建统计记录
	var stat models.CallbackStatistics
	err := database.DB.Where("app_id = ? AND vendor = ? AND date = ?", appID, vendor, today).First(&stat).Error
	if err != nil {
		// 创建新的统计记录
		stat = models.CallbackStatistics{
			AppID:         appID,
			Vendor:        vendor,
			Date:          today,
			TotalCount:    0,
			SuccessCount:  0,
			FailureCount:  0,
			DeliveryCount: 0,
			ClickCount:    0,
		}
	}

	// 更新统计数据
	stat.TotalCount += totalCount
	if success {
		stat.SuccessCount += 1
	} else {
		stat.FailureCount += 1
	}
	stat.DeliveryCount += deliveryCount
	stat.ClickCount += clickCount

	// 保存统计数据
	if stat.ID == 0 {
		database.DB.Create(&stat)
	} else {
		database.DB.Save(&stat)
	}
}
