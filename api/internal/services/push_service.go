package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/internal/push"
	"github.com/doopush/doopush/api/pkg/utils"
	"gorm.io/gorm"
)

// PushService 推送服务
type PushService struct{}

// NewPushService 创建推送服务
func NewPushService() *PushService {
	return &PushService{}
}

// PushRequest 推送请求结构
type PushRequest struct {
	Title    string                 `json:"title" binding:"required"`
	Content  string                 `json:"content" binding:"required"`
	Payload  map[string]interface{} `json:"payload,omitempty"`
	Target   PushTarget             `json:"target" binding:"required"`
	Schedule *time.Time             `json:"schedule_time,omitempty"`
}

// PushTarget 推送目标
type PushTarget struct {
	Type      string `json:"type" binding:"required,oneof=all devices tags groups" example:"devices"`
	DeviceIDs []uint `json:"device_ids,omitempty"`
	TagIDs    []uint `json:"tag_ids,omitempty"`
	GroupIDs  []uint `json:"group_ids,omitempty"`
	Platform  string `json:"platform,omitempty" example:"ios"`
	Channel   string `json:"channel,omitempty" example:"fcm"` // 推送通道筛选
}

// SendPush 发送推送
func (s *PushService) SendPush(appID uint, userID uint, req PushRequest) ([]models.PushLog, error) {
	// 检查用户权限
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, appID, "developer")
	if err != nil {
		return nil, errors.New("权限检查失败")
	}
	if !hasPermission {
		return nil, errors.New("无权限发送推送")
	}

	// 获取目标设备
	devices, err := s.getTargetDevices(appID, req.Target)
	if err != nil {
		return nil, err
	}

	if len(devices) == 0 {
		return nil, errors.New("没有找到目标设备")
	}

	// 准备推送载荷
	payloadJSON := "{}"
	if req.Payload != nil {
		if payload, err := json.Marshal(req.Payload); err == nil {
			payloadJSON = string(payload)
		}
	}

	// 创建推送日志
	var pushLogs []models.PushLog
	for _, device := range devices {
		// 生成去重键
		dedupKey := utils.HashString(fmt.Sprintf("%d_%s_%s_%d",
			appID, req.Title, req.Content, device.ID))

		pushLog := models.PushLog{
			AppID:    appID,
			DeviceID: device.ID,
			Title:    req.Title,
			Content:  req.Content,
			Payload:  payloadJSON,
			Channel:  device.Channel,
			Status:   "pending",
			DedupKey: dedupKey,
		}

		// 如果是定时推送，添加到队列
		if req.Schedule != nil {
			pushLog.Status = "scheduled"
		}

		if err := database.DB.Create(&pushLog).Error; err == nil {
			pushLogs = append(pushLogs, pushLog)
		}
	}

	// 立即推送或加入队列
	if req.Schedule == nil {
		// 立即推送
		go s.processPushLogs(pushLogs)
	} else {
		// 加入定时队列
		go s.scheduleQueuePush(appID, req, *req.Schedule)
	}

	return pushLogs, nil
}

// getTargetDevices 获取目标设备
func (s *PushService) getTargetDevices(appID uint, target PushTarget) ([]models.Device, error) {
	query := database.DB.Where("app_id = ? AND status = 1", appID)

	// 平台筛选
	if target.Platform != "" {
		query = query.Where("platform = ?", target.Platform)
	}

	// 通道筛选
	if target.Channel != "" {
		query = query.Where("channel = ?", target.Channel)
	}

	switch target.Type {
	case "all":
		// 所有设备
		var devices []models.Device
		if err := query.Find(&devices).Error; err != nil {
			return nil, errors.New("获取设备失败")
		}
		return devices, nil

	case "devices":
		// 指定设备
		if len(target.DeviceIDs) == 0 {
			return nil, errors.New("未指定目标设备")
		}
		var devices []models.Device
		if err := query.Where("id IN ?", target.DeviceIDs).Find(&devices).Error; err != nil {
			return nil, errors.New("获取指定设备失败")
		}
		return devices, nil

	case "tags":
		// 标签设备
		if len(target.TagIDs) == 0 {
			return nil, errors.New("未指定目标标签")
		}
		var devices []models.Device
		err := database.DB.Table("devices").
			Joins("JOIN device_tag_maps ON devices.id = device_tag_maps.device_id").
			Where("devices.app_id = ? AND devices.status = 1 AND device_tag_maps.tag_id IN ?", appID, target.TagIDs).
			Find(&devices).Error
		if err != nil {
			return nil, errors.New("获取标签设备失败")
		}
		return devices, nil

	case "groups":
		// 分组设备 - 通过分组条件查询
		if len(target.GroupIDs) == 0 {
			return nil, errors.New("未指定目标分组")
		}

		var allDevices []models.Device
		deviceMap := make(map[uint]models.Device) // 用于去重

		for _, groupID := range target.GroupIDs {
			// 获取分组信息
			group, err := s.getGroupByID(appID, groupID)
			if err != nil {
				log.Printf("获取分组 %d 失败: %v", groupID, err)
				continue
			}

			// 解析分组条件
			var filterRules []FilterRule
			if group.Conditions != "" {
				if err := json.Unmarshal([]byte(group.Conditions), &filterRules); err != nil {
					log.Printf("解析分组 %d 条件失败: %v", groupID, err)
					continue
				}
			}

			// 应用筛选规则查询设备
			groupQuery := database.DB.Debug().Where("app_id = ? AND status = 1", appID)
			groupQuery = s.applyFilterRules(groupQuery, filterRules)

			var groupDevices []models.Device
			if err := groupQuery.Find(&groupDevices).Error; err != nil {
				log.Printf("查询分组 %d 设备失败: %v", groupID, err)
				continue
			}

			// 添加到结果中（去重）
			for _, device := range groupDevices {
				if _, exists := deviceMap[device.ID]; !exists {
					deviceMap[device.ID] = device
					allDevices = append(allDevices, device)
				}
			}
		}

		if len(allDevices) == 0 {
			return nil, errors.New("指定分组中没有找到符合条件的设备")
		}

		return allDevices, nil

	default:
		return nil, errors.New("无效的推送目标类型")
	}
}

// processPushLogs 处理推送日志 (实际推送)
func (s *PushService) processPushLogs(pushLogs []models.PushLog) {
	pushManager := push.NewPushManager()

	for _, pushLog := range pushLogs {
		// 获取设备信息
		var device models.Device
		if err := database.DB.First(&device, pushLog.DeviceID).Error; err != nil {
			// 设备不存在，标记失败
			result := models.PushResult{
				AppID:        pushLog.AppID,
				PushLogID:    pushLog.ID,
				Success:      false,
				ErrorCode:    "DEVICE_NOT_FOUND",
				ErrorMessage: "设备不存在",
				ResponseData: "{}", // 初始化为空 JSON 对象
			}

			database.DB.Create(&result)
			database.DB.Model(&pushLog).Updates(map[string]interface{}{
				"status":  "failed",
				"send_at": utils.TimeNow(),
			})
			continue
		}

		// 发送推送
		result := pushManager.SendPush(&device, &pushLog)

		// 更新推送状态
		status := "failed"
		if result.Success {
			status = "sent"
		}

		// 保存结果到数据库
		database.DB.Create(result)
		database.DB.Model(&pushLog).Updates(map[string]interface{}{
			"status":  status,
			"send_at": utils.TimeNow(),
		})

		// 避免推送过快
		time.Sleep(50 * time.Millisecond)
	}
}

// scheduleQueuePush 加入定时推送队列
func (s *PushService) scheduleQueuePush(appID uint, req PushRequest, scheduleTime time.Time) {
	targetJSON, _ := json.Marshal(req.Target)
	payloadJSON := "{}"
	if req.Payload != nil {
		if payload, err := json.Marshal(req.Payload); err == nil {
			payloadJSON = string(payload)
		}
	}

	queueItem := models.PushQueue{
		AppID:        appID,
		Title:        req.Title,
		Content:      req.Content,
		Payload:      string(payloadJSON),
		Target:       string(targetJSON),
		ScheduleTime: &scheduleTime,
		Status:       "scheduled",
		Priority:     5,
		MaxRetry:     3,
	}

	database.DB.Create(&queueItem)
}

// GetPushLogs 获取推送日志（兼容旧接口）
func (s *PushService) GetPushLogs(appID uint, userID uint, page, pageSize int) ([]models.PushLog, int64, error) {
	return s.GetPushLogsWithFilters(appID, userID, page, pageSize, "", "")
}

// GetPushLogsWithFilters 获取推送日志（支持筛选）
func (s *PushService) GetPushLogsWithFilters(appID uint, userID uint, page, pageSize int, status, platform string) ([]models.PushLog, int64, error) {
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
	query := database.DB.Model(&models.PushLog{}).Where("push_logs.app_id = ?", appID)

	// 添加筛选条件
	if status != "" && status != "all" {
		query = query.Where("push_logs.status = ?", status)
	}

	// 对于platform筛选，我们需要通过关联的Device表进行筛选
	if platform != "" && platform != "all" {
		query = query.Joins("JOIN devices ON push_logs.device_id = devices.id AND push_logs.app_id = devices.app_id").
			Where("devices.platform = ?", platform)
	}

	// 获取总数
	var total int64
	query.Count(&total)

	// 分页查询
	var pushLogs []models.PushLog
	offset := (page - 1) * pageSize
	err = query.
		Preload("Device").     // 预加载设备信息
		Preload("PushResult"). // 预加载推送结果
		Offset(offset).
		Limit(pageSize).
		Order("push_logs.created_at DESC").
		Find(&pushLogs).Error

	if err != nil {
		return nil, 0, errors.New("获取推送日志失败")
	}

	return pushLogs, total, nil
}

// PushStatisticsResponse 推送统计响应
type PushStatisticsResponse struct {
	// 总体统计
	TotalPushes   int64 `json:"total_pushes"`
	SuccessPushes int64 `json:"success_pushes"`
	FailedPushes  int64 `json:"failed_pushes"`
	TotalDevices  int64 `json:"total_devices"`

	// 参与度统计
	TotalClicks int64 `json:"total_clicks"`
	TotalOpens  int64 `json:"total_opens"`

	// 时间序列数据
	DailyStats []DailyStat `json:"daily_stats"`

	// 平台分布
	PlatformStats []PlatformStat `json:"platform_stats"`
}

// DailyStat 每日统计
type DailyStat struct {
	Date          string `json:"date"`
	TotalPushes   int    `json:"total_pushes"`
	SuccessPushes int    `json:"success_pushes"`
	FailedPushes  int    `json:"failed_pushes"`
	ClickCount    int    `json:"click_count"`
	OpenCount     int    `json:"open_count"`
}

// PlatformStat 平台统计
type PlatformStat struct {
	Platform      string `json:"platform"`
	TotalPushes   int64  `json:"total_pushes"`
	SuccessPushes int64  `json:"success_pushes"`
	FailedPushes  int64  `json:"failed_pushes"`
}

// GetPushStatistics 获取推送统计数据
func (s *PushService) GetPushStatistics(appID uint, days int) (*PushStatisticsResponse, error) {
	// 计算时间范围
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -days+1)
	startDate = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, startDate.Location())

	// 总体统计
	var totalPushes, successPushes, failedPushes, totalDevices int64

	// 统计推送总数（半开区间，包含今日）
	database.DB.Model(&models.PushLog{}).
		Where("app_id = ? AND created_at >= ? AND created_at < ?", appID, startDate, endDate).
		Count(&totalPushes)

	// 统计成功推送
	database.DB.Model(&models.PushLog{}).
		Where("app_id = ? AND status = 'sent' AND created_at >= ? AND created_at < ?", appID, startDate, endDate).
		Count(&successPushes)

	// 统计失败推送
	database.DB.Model(&models.PushLog{}).
		Where("app_id = ? AND status = 'failed' AND created_at >= ? AND created_at < ?", appID, startDate, endDate).
		Count(&failedPushes)

	// 统计设备总数
	database.DB.Model(&models.Device{}).
		Where("app_id = ? AND status = 1", appID).
		Count(&totalDevices)

	// 获取每日统计数据（按自然日）
	dailyStats := s.getDailyStats(appID, startDate, endDate)

	// 获取平台统计数据
	platformStats := s.getPlatformStats(appID, startDate)

	// 计算总点击数和打开数（统计表使用自然日 date）
	var totalClicks, totalOpens int64
	database.DB.Model(&models.PushStatistics{}).
		Where("app_id = ? AND date >= ? AND date <= ?", appID, startDate, endDate).
		Select("COALESCE(SUM(click_count), 0)").
		Scan(&totalClicks)

	database.DB.Model(&models.PushStatistics{}).
		Where("app_id = ? AND date >= ? AND date <= ?", appID, startDate, endDate).
		Select("COALESCE(SUM(open_count), 0)").
		Scan(&totalOpens)

	return &PushStatisticsResponse{
		TotalPushes:   totalPushes,
		SuccessPushes: successPushes,
		FailedPushes:  failedPushes,
		TotalDevices:  totalDevices,
		TotalClicks:   totalClicks,
		TotalOpens:    totalOpens,
		DailyStats:    dailyStats,
		PlatformStats: platformStats,
	}, nil
}

// getDailyStats 获取每日统计数据
func (s *PushService) getDailyStats(appID uint, startDate, endDate time.Time) []DailyStat {
	var dailyStats []DailyStat

	// 生成日期范围
	for d := startDate; d.Before(endDate) || d.Equal(endDate); d = d.AddDate(0, 0, 1) {
		dayStart := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, d.Location())
		nextDay := dayStart.AddDate(0, 0, 1)
		dateStr := dayStart.Format("2006-01-02")

		// 查询当日推送统计（半开区间）
		var totalPushes, successPushes, failedPushes int64
		database.DB.Model(&models.PushLog{}).
			Where("app_id = ? AND created_at >= ? AND created_at < ?", appID, dayStart, nextDay).
			Count(&totalPushes)

		database.DB.Model(&models.PushLog{}).
			Where("app_id = ? AND status = 'sent' AND created_at >= ? AND created_at < ?", appID, dayStart, nextDay).
			Count(&successPushes)

		database.DB.Model(&models.PushLog{}).
			Where("app_id = ? AND status = 'failed' AND created_at >= ? AND created_at < ?", appID, dayStart, nextDay).
			Count(&failedPushes)

		// 查询点击和打开数据（从统计表，使用自然日匹配）
		var clickCount, openCount int
		var stat models.PushStatistics
		err := database.DB.Where("app_id = ? AND date = ?", appID, dayStart).First(&stat).Error
		if err == nil {
			clickCount = stat.ClickCount
			openCount = stat.OpenCount
		}

		dailyStats = append(dailyStats, DailyStat{
			Date:          dateStr,
			TotalPushes:   int(totalPushes),
			SuccessPushes: int(successPushes),
			FailedPushes:  int(failedPushes),
			ClickCount:    clickCount,
			OpenCount:     openCount,
		})
	}

	return dailyStats
}

// getPlatformStats 获取平台统计数据
func (s *PushService) getPlatformStats(appID uint, startDate time.Time) []PlatformStat {
	var platformStats []PlatformStat

	// 查询iOS平台统计
	var iosTotal, iosSuccess, iosFailed int64
	database.DB.Model(&models.PushLog{}).
		Joins("JOIN devices ON push_logs.device_id = devices.id").
		Where("push_logs.app_id = ? AND devices.platform = 'ios' AND push_logs.created_at >= ?", appID, startDate).
		Count(&iosTotal)

	database.DB.Model(&models.PushLog{}).
		Joins("JOIN devices ON push_logs.device_id = devices.id").
		Where("push_logs.app_id = ? AND devices.platform = 'ios' AND push_logs.status = 'sent' AND push_logs.created_at >= ?", appID, startDate).
		Count(&iosSuccess)

	database.DB.Model(&models.PushLog{}).
		Joins("JOIN devices ON push_logs.device_id = devices.id").
		Where("push_logs.app_id = ? AND devices.platform = 'ios' AND push_logs.status = 'failed' AND push_logs.created_at >= ?", appID, startDate).
		Count(&iosFailed)

	// 查询Android平台统计
	var androidTotal, androidSuccess, androidFailed int64
	database.DB.Model(&models.PushLog{}).
		Joins("JOIN devices ON push_logs.device_id = devices.id").
		Where("push_logs.app_id = ? AND devices.platform = 'android' AND push_logs.created_at >= ?", appID, startDate).
		Count(&androidTotal)

	database.DB.Model(&models.PushLog{}).
		Joins("JOIN devices ON push_logs.device_id = devices.id").
		Where("push_logs.app_id = ? AND devices.platform = 'android' AND push_logs.status = 'sent' AND push_logs.created_at >= ?", appID, startDate).
		Count(&androidSuccess)

	database.DB.Model(&models.PushLog{}).
		Joins("JOIN devices ON push_logs.device_id = devices.id").
		Where("push_logs.app_id = ? AND devices.platform = 'android' AND push_logs.status = 'failed' AND push_logs.created_at >= ?", appID, startDate).
		Count(&androidFailed)

	if iosTotal > 0 {
		platformStats = append(platformStats, PlatformStat{
			Platform:      "ios",
			TotalPushes:   iosTotal,
			SuccessPushes: iosSuccess,
			FailedPushes:  iosFailed,
		})
	}

	if androidTotal > 0 {
		platformStats = append(platformStats, PlatformStat{
			Platform:      "android",
			TotalPushes:   androidTotal,
			SuccessPushes: androidSuccess,
			FailedPushes:  androidFailed,
		})
	}

	return platformStats
}

// PushStatisticsEventReport 推送统计事件上报结构（与控制器保持一致）
type PushStatisticsEventReport struct {
	PushLogID uint   `json:"push_log_id,omitempty"`
	DedupKey  string `json:"dedup_key,omitempty"`
	Event     string `json:"event" binding:"required,oneof=click open"`
	Timestamp int64  `json:"timestamp" binding:"required"`
}

// ReportPushStatistics 处理推送统计数据上报
func (s *PushService) ReportPushStatistics(appID uint, deviceToken string, reports []PushStatisticsEventReport) error {
	// 验证设备是否存在
	var device models.Device
	if err := database.DB.Where("app_id = ? AND token = ? AND status = 1", appID, deviceToken).First(&device).Error; err != nil {
		return errors.New("设备不存在")
	}

	// 按日期分组统计，用于批量更新 PushStatistics 表
	dateStatsMap := make(map[string]*models.PushStatistics)

	// 处理每个统计事件
	for _, report := range reports {
		if report.Event != "click" && report.Event != "open" {
			continue // 跳过无效事件类型
		}

		// 通过 push_log_id 或 dedup_key 查找推送记录
		var pushLog models.PushLog
		var found bool

		if report.PushLogID > 0 {
			// 优先使用 push_log_id
			err := database.DB.Where("id = ? AND app_id = ? AND device_id = ?", report.PushLogID, appID, device.ID).First(&pushLog).Error
			found = (err == nil)
		} else if report.DedupKey != "" {
			// 使用 dedup_key 查找
			err := database.DB.Where("dedup_key = ? AND app_id = ? AND device_id = ?", report.DedupKey, appID, device.ID).First(&pushLog).Error
			found = (err == nil)
		}

		if !found {
			log.Printf("推送记录不存在: push_log_id=%d, dedup_key=%s", report.PushLogID, report.DedupKey)
			continue // 跳过找不到的推送记录
		}

		// 计算事件发生的日期
		eventTime := time.Unix(report.Timestamp, 0)
		dateStr := eventTime.Format("2006-01-02")

		// 获取或创建日期统计记录
		if _, exists := dateStatsMap[dateStr]; !exists {
			var stat models.PushStatistics
			err := database.DB.Where("app_id = ? AND date = ?", appID, eventTime.Truncate(24*time.Hour)).First(&stat).Error
			if err != nil {
				// 如果不存在，创建新记录
				stat = models.PushStatistics{
					AppID:         appID,
					Date:          eventTime.Truncate(24 * time.Hour),
					TotalPushes:   0,
					SuccessPushes: 0,
					FailedPushes:  0,
					ClickCount:    0,
					OpenCount:     0,
				}
			}
			dateStatsMap[dateStr] = &stat
		}

		// 更新对应的统计数据
		switch report.Event {
		case "click":
			dateStatsMap[dateStr].ClickCount++
		case "open":
			dateStatsMap[dateStr].OpenCount++
		}

		log.Printf("统计事件记录: 设备=%s, 事件=%s, 推送=%d", deviceToken, report.Event, pushLog.ID)
	}

	// 批量更新或创建统计记录
	for dateStr, stat := range dateStatsMap {
		if stat.ID == 0 {
			// 新建记录
			if err := database.DB.Create(stat).Error; err != nil {
				log.Printf("创建统计记录失败: %s - %v", dateStr, err)
				return errors.New("统计数据保存失败")
			}
		} else {
			// 更新现有记录
			if err := database.DB.Save(stat).Error; err != nil {
				log.Printf("更新统计记录失败: %s - %v", dateStr, err)
				return errors.New("统计数据更新失败")
			}
		}
		log.Printf("统计数据已更新: %s - 点击:%d, 打开:%d", dateStr, stat.ClickCount, stat.OpenCount)
	}

	return nil
}

// getGroupByID 根据ID获取分组信息
func (s *PushService) getGroupByID(appID, groupID uint) (*models.DeviceGroup, error) {
	var group models.DeviceGroup
	err := database.DB.Where("app_id = ? AND id = ? AND status = 1", appID, groupID).First(&group).Error
	if err != nil {
		return nil, fmt.Errorf("分组不存在或已禁用")
	}
	return &group, nil
}

// applyFilterRules 应用筛选规则到查询
func (s *PushService) applyFilterRules(query *gorm.DB, filterRules []FilterRule) *gorm.DB {
	for _, rule := range filterRules {
		switch rule.Operator {
		case "equals":
			if rule.Value.StringValue != "" {
				query = query.Where(fmt.Sprintf("%s = ?", rule.Field), rule.Value.StringValue)
			}
		case "contains":
			if rule.Value.StringValue != "" {
				query = query.Where(fmt.Sprintf("%s LIKE ?", rule.Field), fmt.Sprintf("%%%s%%", rule.Value.StringValue))
			}
		case "in":
			if len(rule.Value.StringValues) > 0 {
				query = query.Where(fmt.Sprintf("%s IN ?", rule.Field), rule.Value.StringValues)
			}
		case "not_in":
			if len(rule.Value.StringValues) > 0 {
				query = query.Where(fmt.Sprintf("%s NOT IN ?", rule.Field), rule.Value.StringValues)
			}
		case "is_null":
			query = query.Where(fmt.Sprintf("%s IS NULL", rule.Field))
		case "is_not_null":
			query = query.Where(fmt.Sprintf("%s IS NOT NULL", rule.Field))
		}
	}
	return query
}
