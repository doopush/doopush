package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/internal/push"
	"github.com/doopush/doopush/api/pkg/utils"
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
		// 分组设备
		if len(target.GroupIDs) == 0 {
			return nil, errors.New("未指定目标分组")
		}
		var devices []models.Device
		err := database.DB.Table("devices").
			Joins("JOIN device_group_maps ON devices.id = device_group_maps.device_id").
			Where("devices.app_id = ? AND devices.status = 1 AND device_group_maps.group_id IN ?", appID, target.GroupIDs).
			Find(&devices).Error
		if err != nil {
			return nil, errors.New("获取分组设备失败")
		}
		return devices, nil

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

	// 总体统计
	var totalPushes, successPushes, failedPushes, totalDevices int64

	// 统计推送总数
	database.DB.Model(&models.PushLog{}).
		Where("app_id = ? AND created_at >= ?", appID, startDate).
		Count(&totalPushes)

	// 统计成功推送
	database.DB.Model(&models.PushLog{}).
		Where("app_id = ? AND status = 'sent' AND created_at >= ?", appID, startDate).
		Count(&successPushes)

	// 统计失败推送
	database.DB.Model(&models.PushLog{}).
		Where("app_id = ? AND status = 'failed' AND created_at >= ?", appID, startDate).
		Count(&failedPushes)

	// 统计设备总数
	database.DB.Model(&models.Device{}).
		Where("app_id = ? AND status = 1", appID).
		Count(&totalDevices)

	// 获取每日统计数据
	dailyStats := s.getDailyStats(appID, startDate, endDate)

	// 获取平台统计数据
	platformStats := s.getPlatformStats(appID, startDate)

	// 计算总点击数和打开数（从已有的统计表或模拟）
	var totalClicks, totalOpens int64
	database.DB.Model(&models.PushStatistics{}).
		Where("app_id = ? AND date >= ?", appID, startDate).
		Select("COALESCE(SUM(click_count), 0)").
		Scan(&totalClicks)

	database.DB.Model(&models.PushStatistics{}).
		Where("app_id = ? AND date >= ?", appID, startDate).
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
		dateStr := d.Format("2006-01-02")
		nextDay := d.AddDate(0, 0, 1)

		// 查询当日推送统计
		var totalPushes, successPushes, failedPushes int64
		database.DB.Model(&models.PushLog{}).
			Where("app_id = ? AND created_at >= ? AND created_at < ?", appID, d, nextDay).
			Count(&totalPushes)

		database.DB.Model(&models.PushLog{}).
			Where("app_id = ? AND status = 'sent' AND created_at >= ? AND created_at < ?", appID, d, nextDay).
			Count(&successPushes)

		database.DB.Model(&models.PushLog{}).
			Where("app_id = ? AND status = 'failed' AND created_at >= ? AND created_at < ?", appID, d, nextDay).
			Count(&failedPushes)

		// 查询点击和打开数据（从统计表）
		var clickCount, openCount int
		var stat models.PushStatistics
		err := database.DB.Where("app_id = ? AND date = ?", appID, d).First(&stat).Error
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
