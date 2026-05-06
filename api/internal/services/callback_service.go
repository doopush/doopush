package services

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/logger"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// CallbackService 回执处理服务
type CallbackService struct{}

// NewCallbackService 创建回执处理服务
func NewCallbackService() *CallbackService {
	return &CallbackService{}
}

// statDelta 单个回执对当日厂商统计的增量。
type statDelta struct {
	total    int
	success  int
	failure  int
	delivery int
	click    int
}

// statsAccumulator 累计 (appID, vendor, day) -> 增量，最后一次性 UPSERT 到 DB。
// 避免在 token 循环中对同一 (app, vendor, day) 反复读改写造成竞态和写放大。
type statsAccumulator struct {
	buckets map[string]*statBucket
}

type statBucket struct {
	appID  uint
	vendor string
	date   time.Time
	delta  statDelta
}

func newStatsAccumulator() *statsAccumulator {
	return &statsAccumulator{buckets: make(map[string]*statBucket)}
}

func (a *statsAccumulator) add(appID uint, vendor string, date time.Time, d statDelta) {
	key := fmt.Sprintf("%d|%s|%d", appID, vendor, date.Unix())
	b, ok := a.buckets[key]
	if !ok {
		b = &statBucket{appID: appID, vendor: vendor, date: date}
		a.buckets[key] = b
	}
	b.delta.total += d.total
	b.delta.success += d.success
	b.delta.failure += d.failure
	b.delta.delivery += d.delivery
	b.delta.click += d.click
}

// flush 将累计的增量原子地写入 callback_statistics。
// 使用 ON CONFLICT/DUPLICATE KEY UPDATE 保证并发安全（依赖 (app_id, vendor, date) 唯一索引）。
func (a *statsAccumulator) flush() {
	for _, b := range a.buckets {
		row := models.CallbackStatistics{
			AppID:         b.appID,
			Vendor:        b.vendor,
			Date:          b.date,
			TotalCount:    b.delta.total,
			SuccessCount:  b.delta.success,
			FailureCount:  b.delta.failure,
			DeliveryCount: b.delta.delivery,
			ClickCount:    b.delta.click,
		}
		err := database.DB.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "app_id"}, {Name: "vendor"}, {Name: "date"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"total_count":    gorm.Expr("total_count + ?", b.delta.total),
				"success_count":  gorm.Expr("success_count + ?", b.delta.success),
				"failure_count":  gorm.Expr("failure_count + ?", b.delta.failure),
				"delivery_count": gorm.Expr("delivery_count + ?", b.delta.delivery),
				"click_count":    gorm.Expr("click_count + ?", b.delta.click),
				"updated_at":     time.Now(),
			}),
		}).Create(&row).Error
		if err != nil {
			logger.Error("更新回执统计失败", b.vendor, err)
		}
	}
}

func todayUTC() time.Time {
	return time.Now().Truncate(24 * time.Hour)
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// ProcessHuaweiCallback 处理华为推送回执
func (s *CallbackService) ProcessHuaweiCallback(callback interface{}) error {
	data, ok := callback.(map[string]interface{})
	if !ok {
		return fmt.Errorf("华为回执数据格式错误")
	}
	message, ok := data["message"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("华为回执消息数据格式错误")
	}
	tokens, ok := message["token"].([]interface{})
	if !ok {
		return fmt.Errorf("华为回执token数据格式错误")
	}

	biTag := ""
	if android, _ := message["android"].(map[string]interface{}); android != nil {
		biTag, _ = android["bi_tag"].(string)
	}
	notification, _ := message["notification"].(map[string]interface{})
	title, _ := notification["title"].(string)
	body, _ := notification["body"].(string)
	rawData, _ := json.Marshal(data)
	validateOnly, _ := data["validate_only"].(bool)

	tokenStrs := toStringSlice(tokens)
	deviceMap := s.findDevicesByTokens("huawei", tokenStrs)

	stats := newStatsAccumulator()
	rows := make([]models.HuaweiCallback, 0, len(tokenStrs))
	for _, token := range tokenStrs {
		device, ok := deviceMap[token]
		if !ok {
			continue
		}
		pushLog, ok := s.findPushLog("huawei", device.ID, biTag)
		if !ok {
			continue
		}
		rows = append(rows, models.HuaweiCallback{
			BaseCallback: models.BaseCallback{
				AppID:       device.AppID,
				DeviceID:    device.ID,
				PushLogID:   pushLog.ID,
				MessageID:   biTag,
				DeviceToken: token,
				EventType:   1,
				Success:     true,
				Timestamp:   time.Now().UnixMilli(),
				ProcessedAt: time.Now(),
			},
			BiTag:        biTag,
			ValidateOnly: validateOnly,
			Title:        title,
			Body:         body,
			RawData:      string(rawData),
		})
		stats.add(device.AppID, "huawei", todayUTC(), statDelta{total: 1, success: 1, delivery: 1})
	}
	createInBatches(rows)
	stats.flush()
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

	tokens := make([]string, 0, len(statuses))
	for _, si := range statuses {
		if status, ok := si.(map[string]interface{}); ok {
			if t, _ := status["token"].(string); t != "" {
				tokens = append(tokens, t)
			}
		}
	}
	deviceMap := s.findDevicesByTokens("honor", tokens)

	stats := newStatsAccumulator()
	rows := make([]models.HonorCallback, 0, len(statuses))
	for _, si := range statuses {
		status, ok := si.(map[string]interface{})
		if !ok {
			continue
		}
		token, _ := status["token"].(string)
		biTag, _ := status["biTag"].(string)
		statusCode, _ := status["status"].(float64)
		timestamp, _ := status["timestamp"].(float64)
		requestID, _ := status["requestId"].(string)

		device, ok := deviceMap[token]
		if !ok {
			continue
		}
		pushLog, ok := s.findPushLog("honor", device.ID, biTag)
		if !ok {
			continue
		}
		// 荣耀回执：status 为 40000002 表示送达成功
		success := int(statusCode) == 40000002
		rows = append(rows, models.HonorCallback{
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
		})
		stats.add(device.AppID, "honor", todayUTC(), statDelta{
			total:    1,
			success:  boolToInt(success),
			failure:  boolToInt(!success),
			delivery: boolToInt(success),
		})
	}
	createInBatches(rows)
	stats.flush()
	return nil
}

// ProcessOppoCallback 处理OPPO推送回执
func (s *CallbackService) ProcessOppoCallback(callbacks []interface{}) error {
	type oppoItem struct {
		messageID string
		taskID    string
		regIDs    string
		eventTime string
		param     string
		eventType string
		raw       []byte
		timestamp int64
	}

	// 第一遍：解析 + 收集所有 token
	items := make([]oppoItem, 0, len(callbacks))
	allTokens := make([]string, 0)
	for _, ci := range callbacks {
		data, ok := ci.(map[string]interface{})
		if !ok {
			continue
		}
		raw, _ := json.Marshal(data)
		ts := time.Now().UnixMilli()
		if et, _ := data["eventTime"].(string); et != "" {
			if t, err := strconv.ParseInt(et, 10, 64); err == nil {
				ts = t
			}
		}
		messageID, _ := data["messageId"].(string)
		taskID, _ := data["taskId"].(string)
		regIDs, _ := data["registrationIds"].(string)
		eventTimeStr, _ := data["eventTime"].(string)
		param, _ := data["param"].(string)
		eventType, _ := data["eventType"].(string)
		item := oppoItem{
			messageID: messageID,
			taskID:    taskID,
			regIDs:    regIDs,
			eventTime: eventTimeStr,
			param:     param,
			eventType: eventType,
			raw:       raw,
			timestamp: ts,
		}
		items = append(items, item)
		for _, r := range strings.Split(regIDs, ",") {
			if r = strings.TrimSpace(r); r != "" {
				allTokens = append(allTokens, r)
			}
		}
	}
	deviceMap := s.findDevicesByTokens("oppo", allTokens)

	stats := newStatsAccumulator()
	rows := make([]models.OppoCallback, 0)
	for _, it := range items {
		for _, regID := range strings.Split(it.regIDs, ",") {
			regID = strings.TrimSpace(regID)
			if regID == "" {
				continue
			}
			device, ok := deviceMap[regID]
			if !ok {
				continue
			}
			pushLog, ok := s.findPushLog("oppo", device.ID, it.messageID)
			if !ok {
				continue
			}
			rows = append(rows, models.OppoCallback{
				BaseCallback: models.BaseCallback{
					AppID:       device.AppID,
					DeviceID:    device.ID,
					PushLogID:   pushLog.ID,
					MessageID:   it.messageID,
					DeviceToken: regID,
					EventType:   1,
					Success:     true,
					Timestamp:   it.timestamp,
					ProcessedAt: time.Now(),
				},
				TaskID:          it.taskID,
				RegistrationIDs: it.regIDs,
				EventTime:       it.eventTime,
				Param:           it.param,
				EventTypeName:   it.eventType,
				RawData:         string(it.raw),
			})
			stats.add(device.AppID, "oppo", todayUTC(), statDelta{total: 1, success: 1, delivery: 1})
		}
	}
	createInBatches(rows)
	stats.flush()
	return nil
}

// ProcessVivoCallback 处理VIVO推送回执
func (s *CallbackService) ProcessVivoCallback(callback map[string]interface{}) error {
	rawData, _ := json.Marshal(callback)

	tokens := make([]string, 0, len(callback))
	for _, di := range callback {
		if data, ok := di.(map[string]interface{}); ok {
			if t, _ := data["targets"].(string); t != "" {
				tokens = append(tokens, t)
			}
		}
	}
	deviceMap := s.findDevicesByTokens("vivo", tokens)

	stats := newStatsAccumulator()
	rows := make([]models.VivoCallback, 0, len(callback))
	for taskID, di := range callback {
		data, ok := di.(map[string]interface{})
		if !ok {
			continue
		}
		targets, _ := data["targets"].(string)
		ackTime, _ := data["ackTime"].(float64)
		param, _ := data["param"].(string)
		ackType, _ := data["ackType"].(string)

		device, ok := deviceMap[targets]
		if !ok {
			continue
		}
		pushLog, ok := s.findPushLog("vivo", device.ID, taskID)
		if !ok {
			continue
		}
		// VIVO 回执：ackType "0" 表示送达成功
		success := ackType == "0"
		rows = append(rows, models.VivoCallback{
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
		})
		stats.add(device.AppID, "vivo", todayUTC(), statDelta{
			total:    1,
			success:  boolToInt(success),
			failure:  boolToInt(!success),
			delivery: boolToInt(success),
		})
	}
	createInBatches(rows)
	stats.flush()
	return nil
}

// ProcessXiaomiCallback 处理小米推送回执
func (s *CallbackService) ProcessXiaomiCallback(callback map[string]interface{}) error {
	rawData, _ := json.Marshal(callback)

	allTokens := make([]string, 0)
	for _, di := range callback {
		if data, ok := di.(map[string]interface{}); ok {
			if targets, _ := data["targets"].(string); targets != "" {
				for _, t := range strings.Split(targets, ",") {
					if t = strings.TrimSpace(t); t != "" {
						allTokens = append(allTokens, t)
					}
				}
			}
		}
	}
	deviceMap := s.findDevicesByTokens("xiaomi", allTokens)

	stats := newStatsAccumulator()
	rows := make([]models.XiaomiCallback, 0)
	for msgID, di := range callback {
		data, ok := di.(map[string]interface{})
		if !ok {
			continue
		}
		param, _ := data["param"].(string)
		typeCode, _ := data["type"].(float64)
		targets, _ := data["targets"].(string)
		jobKey, _ := data["jobkey"].(string)
		barStatus, _ := data["barStatus"].(string)
		timestamp, _ := data["timestamp"].(float64)

		// 小米回执：type=1 送达，type=2 点击，type=16 无效设备
		eventType := int(typeCode)
		success := eventType != 16

		for _, target := range strings.Split(targets, ",") {
			target = strings.TrimSpace(target)
			if target == "" {
				continue
			}
			device, ok := deviceMap[target]
			if !ok {
				continue
			}
			pushLog, ok := s.findPushLog("xiaomi", device.ID, msgID)
			if !ok {
				continue
			}
			rows = append(rows, models.XiaomiCallback{
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
			})
			delta := statDelta{
				total:   1,
				success: boolToInt(success),
				failure: boolToInt(!success),
			}
			if success {
				if eventType == 2 {
					delta.click = 1
				} else {
					delta.delivery = 1
				}
			}
			stats.add(device.AppID, "xiaomi", todayUTC(), delta)
		}
	}
	createInBatches(rows)
	stats.flush()
	return nil
}

// ProcessMeizuCallback 处理魅族推送回执
func (s *CallbackService) ProcessMeizuCallback(callback map[string]interface{}) error {
	rawData, _ := json.Marshal(callback)

	allTokens := make([]string, 0)
	for _, di := range callback {
		if data, ok := di.(map[string]interface{}); ok {
			if ts, _ := data["targets"].([]interface{}); ts != nil {
				for _, t := range ts {
					if s, ok := t.(string); ok && s != "" {
						allTokens = append(allTokens, s)
					}
				}
			}
		}
	}
	deviceMap := s.findDevicesByTokens("meizu", allTokens)

	stats := newStatsAccumulator()
	rows := make([]models.MeizuCallback, 0)
	for msgID, di := range callback {
		data, ok := di.(map[string]interface{})
		if !ok {
			continue
		}
		param, _ := data["param"].(string)
		typeCode, _ := data["type"].(float64)
		targetsInterface, _ := data["targets"].([]interface{})

		eventType := int(typeCode)

		for _, ti := range targetsInterface {
			target, ok := ti.(string)
			if !ok {
				continue
			}
			target = strings.TrimSpace(target)
			if target == "" {
				continue
			}
			device, ok := deviceMap[target]
			if !ok {
				continue
			}
			pushLog, ok := s.findPushLog("meizu", device.ID, msgID)
			if !ok {
				continue
			}
			rows = append(rows, models.MeizuCallback{
				BaseCallback: models.BaseCallback{
					AppID:       device.AppID,
					DeviceID:    device.ID,
					PushLogID:   pushLog.ID,
					MessageID:   msgID,
					DeviceToken: target,
					EventType:   eventType,
					Success:     true,
					Timestamp:   time.Now().UnixMilli(),
					ProcessedAt: time.Now(),
				},
				Param:   param,
				Type:    eventType,
				Targets: target,
				RawData: string(rawData),
			})
			delta := statDelta{total: 1, success: 1}
			if eventType == 2 {
				delta.click = 1
			} else {
				delta.delivery = 1
			}
			stats.add(device.AppID, "meizu", todayUTC(), delta)
		}
	}
	createInBatches(rows)
	stats.flush()
	return nil
}

// findDevicesByTokens 一次查询批量解析 token -> device，避免 token 循环中的 N+1 查询。
func (s *CallbackService) findDevicesByTokens(vendor string, tokens []string) map[string]models.Device {
	result := make(map[string]models.Device)
	if len(tokens) == 0 {
		return result
	}
	// 去重
	seen := make(map[string]struct{}, len(tokens))
	uniq := make([]string, 0, len(tokens))
	for _, t := range tokens {
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		uniq = append(uniq, t)
	}
	if len(uniq) == 0 {
		return result
	}
	var devices []models.Device
	if err := database.DB.Where("token IN ? AND channel = ?", uniq, vendor).Find(&devices).Error; err != nil {
		logger.Error("批量查询设备失败", vendor, err)
		return result
	}
	for _, d := range devices {
		result[d.Token] = d
	}
	return result
}

// findPushLog 查找设备对应的推送日志：优先 push_log_id 数字 → dedup_key。
// 已删除"找最近一条"的兜底，避免把回执错误关联到无关推送上。
func (s *CallbackService) findPushLog(vendor string, deviceID uint, messageID string) (*models.PushLog, bool) {
	if messageID == "" {
		return nil, false
	}
	var pushLog models.PushLog
	if pushLogID, err := strconv.ParseUint(messageID, 10, 32); err == nil {
		if database.DB.Where("id = ? AND device_id = ?", pushLogID, deviceID).First(&pushLog).Error == nil {
			return &pushLog, true
		}
	}
	if database.DB.Where("dedup_key = ? AND device_id = ?", messageID, deviceID).First(&pushLog).Error == nil {
		return &pushLog, true
	}
	return nil, false
}

// createInBatches 批量插入回执；空切片直接返回。
func createInBatches[T any](rows []T) {
	if len(rows) == 0 {
		return
	}
	if err := database.DB.CreateInBatches(rows, 200).Error; err != nil {
		logger.Error("批量保存回执失败", err)
	}
}

func toStringSlice(items []interface{}) []string {
	out := make([]string, 0, len(items))
	for _, i := range items {
		if s, ok := i.(string); ok && s != "" {
			out = append(out, s)
		}
	}
	return out
}
