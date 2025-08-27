package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
)

// SchedulerService 定时推送服务
type SchedulerService struct {
	stopChan chan bool
}

// NewSchedulerService 创建定时推送服务实例
func NewSchedulerService() *SchedulerService {
	service := &SchedulerService{
		stopChan: make(chan bool),
	}

	// 启动定时任务调度器
	go service.startScheduler()

	return service
}

// CreateScheduledPush 创建定时推送
func (s *SchedulerService) CreateScheduledPush(appID uint, userID uint, name string, templateID *uint, targetType, targetValue string, scheduleTime time.Time, timezone, repeatType, cronExpr string) (*models.ScheduledPush, error) {
	return s.CreateScheduledPushWithContent(appID, userID, name, "", "", "", "", targetType, targetValue, scheduleTime, timezone, repeatType, "", cronExpr)
}

// CreateScheduledPushWithContent 创建包含推送内容的定时推送
func (s *SchedulerService) CreateScheduledPushWithContent(appID uint, userID uint, name, title, content, payload, pushType, targetType, targetValue string, scheduleTime time.Time, timezone, repeatType, repeatConfig, cronExpr string) (*models.ScheduledPush, error) {
	// 检查任务名是否重复
	var existingPush models.ScheduledPush
	err := database.DB.Where("app_id = ? AND name = ?", appID, name).First(&existingPush).Error
	if err == nil {
		return nil, fmt.Errorf("任务名称已存在")
	}

	// 处理和验证 payload
	if payload == "" {
		payload = "{}" // 确保空字符串被设置为空 JSON 对象
	}
	if !utils.StringIsValidJSON(payload) {
		return nil, fmt.Errorf("payload必须是有效的JSON格式")
	}

	// 计算下次执行时间
	nextRunAt := s.calculateNextRunTime(scheduleTime, repeatType, cronExpr)

	// 如果没有明确指定 push_type，则根据 targetType 推断
	if pushType == "" {
		switch targetType {
		case "devices":
			pushType = "single"
		case "groups", "tags":
			pushType = "batch"
		case "all":
			pushType = "broadcast"
		default:
			pushType = "broadcast"
		}
	}

	scheduledPush := &models.ScheduledPush{
		AppID:        appID,
		Name:         name,
		Title:        title,   // 推送标题
		Content:      content, // 推送内容
		Payload:      payload, // 推送载荷
		PushType:     pushType,
		TargetType:   targetType,
		TargetValue:  targetValue,
		ScheduleTime: scheduleTime,
		Timezone:     timezone,
		RepeatType:   repeatType,
		RepeatConfig: repeatConfig,
		CronExpr:     cronExpr,
		NextRunAt:    &nextRunAt,
		Status:       "pending", // 新创建的任务默认为pending状态，等待调度器执行
		CreatedBy:    userID,
	}

	if err := database.DB.Create(scheduledPush).Error; err != nil {
		return nil, fmt.Errorf("创建定时推送失败: %v", err)
	}

	return scheduledPush, nil
}

// GetScheduledPushes 获取定时推送列表（向后兼容）
func (s *SchedulerService) GetScheduledPushes(appID uint, status string, page, pageSize int) ([]models.ScheduledPush, int64, error) {
	return s.GetScheduledPushesWithFilters(appID, "", status, "", page, pageSize)
}

// GetScheduledPushesWithFilters 获取定时推送列表（支持搜索和筛选）
func (s *SchedulerService) GetScheduledPushesWithFilters(appID uint, search, status, repeatType string, page, pageSize int) ([]models.ScheduledPush, int64, error) {
	query := database.DB.Where("app_id = ?", appID)

	// 搜索条件：标题或内容包含搜索关键词
	if search != "" {
		query = query.Where("(title LIKE ? OR content LIKE ? OR name LIKE ?)",
			"%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	// 状态筛选
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}

	// 重复类型筛选
	if repeatType != "" && repeatType != "all" {
		// 前端传递的是 "none", "daily", "weekly", "monthly"
		// 后端存储的是 "once", "daily", "weekly", "monthly"
		if repeatType == "none" {
			repeatType = "once"
		}
		query = query.Where("repeat_type = ?", repeatType)
	}

	// 先计算总数
	var total int64
	query.Model(&models.ScheduledPush{}).Count(&total)

	// 分页查询
	var pushes []models.ScheduledPush
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).
		Order("created_at DESC").Find(&pushes).Error

	return pushes, total, err
}

// GetScheduledPushStats 获取定时推送统计数据
func (s *SchedulerService) GetScheduledPushStats(appID uint) (map[string]int64, error) {
	stats := make(map[string]int64)

	var count int64

	// 统计总任务数
	if err := database.DB.Model(&models.ScheduledPush{}).Where("app_id = ?", appID).Count(&count).Error; err != nil {
		return nil, err
	}
	stats["total"] = count

	// 统计各状态的任务数
	if err := database.DB.Model(&models.ScheduledPush{}).Where("app_id = ? AND status = ?", appID, "pending").Count(&count).Error; err != nil {
		return nil, err
	}
	stats["pending"] = count

	if err := database.DB.Model(&models.ScheduledPush{}).Where("app_id = ? AND status = ?", appID, "running").Count(&count).Error; err != nil {
		return nil, err
	}
	stats["running"] = count

	if err := database.DB.Model(&models.ScheduledPush{}).Where("app_id = ? AND status = ?", appID, "completed").Count(&count).Error; err != nil {
		return nil, err
	}
	stats["completed"] = count

	if err := database.DB.Model(&models.ScheduledPush{}).Where("app_id = ? AND status = ?", appID, "failed").Count(&count).Error; err != nil {
		return nil, err
	}
	stats["failed"] = count

	if err := database.DB.Model(&models.ScheduledPush{}).Where("app_id = ? AND status = ?", appID, "paused").Count(&count).Error; err != nil {
		return nil, err
	}
	stats["paused"] = count

	return stats, nil
}

// GetScheduledPush 获取单个定时推送
func (s *SchedulerService) GetScheduledPush(appID uint, pushID uint) (*models.ScheduledPush, error) {
	var push models.ScheduledPush
	err := database.DB.Where("app_id = ? AND id = ?", appID, pushID).First(&push).Error
	if err != nil {
		return nil, fmt.Errorf("定时推送不存在")
	}
	return &push, nil
}

// UpdateScheduledPush 更新定时推送
func (s *SchedulerService) UpdateScheduledPush(appID uint, pushID uint, name string, templateID *uint, targetType, targetValue string, scheduleTime time.Time, timezone, repeatType, cronExpr string) (*models.ScheduledPush, error) {
	var push models.ScheduledPush
	err := database.DB.Where("app_id = ? AND id = ?", appID, pushID).First(&push).Error
	if err != nil {
		return nil, fmt.Errorf("定时推送不存在")
	}

	// 检查名称是否与其他任务冲突
	if name != push.Name {
		var existingPush models.ScheduledPush
		err := database.DB.Where("app_id = ? AND name = ? AND id != ?", appID, name, pushID).First(&existingPush).Error
		if err == nil {
			return nil, fmt.Errorf("任务名称已存在")
		}
	}

	// 更新任务信息
	push.Name = name
	push.TemplateID = templateID
	push.TargetType = targetType
	push.TargetValue = targetValue
	push.ScheduleTime = scheduleTime
	push.Timezone = timezone
	push.RepeatType = repeatType
	push.CronExpr = cronExpr

	// 重新计算下次执行时间
	nextRunAt := s.calculateNextRunTime(scheduleTime, repeatType, cronExpr)
	push.NextRunAt = &nextRunAt

	if err := database.DB.Save(&push).Error; err != nil {
		return nil, fmt.Errorf("更新定时推送失败: %v", err)
	}

	return &push, nil
}

// UpdateScheduledPushWithContent 更新包含推送内容的定时推送
func (s *SchedulerService) UpdateScheduledPushWithContent(appID uint, pushID uint, name, title, content, payload, pushType, targetType, targetValue string, scheduleTime time.Time, timezone, repeatType, repeatConfig, cronExpr, status string) (*models.ScheduledPush, error) {
	var push models.ScheduledPush
	err := database.DB.Where("app_id = ? AND id = ?", appID, pushID).First(&push).Error
	if err != nil {
		return nil, fmt.Errorf("定时推送不存在")
	}

	// 检查名称是否与其他任务冲突
	if name != push.Name {
		var existingPush models.ScheduledPush
		err := database.DB.Where("app_id = ? AND name = ? AND id != ?", appID, name, pushID).First(&existingPush).Error
		if err == nil {
			return nil, fmt.Errorf("任务名称已存在")
		}
	}

	// 处理和验证 payload
	if payload == "" {
		payload = "{}" // 确保空字符串被设置为空 JSON 对象
	}
	if !utils.StringIsValidJSON(payload) {
		return nil, fmt.Errorf("payload必须是有效的JSON格式")
	}

	// 如果没有明确指定 push_type，则保持现有值或根据 targetType 推断
	if pushType == "" {
		pushType = push.PushType // 保持现有值
		if pushType == "" {
			pushType = "broadcast" // 默认值
			switch targetType {
			case "devices":
				pushType = "single"
			case "groups", "tags":
				pushType = "batch"
			case "all":
				pushType = "broadcast"
			default:
				pushType = "broadcast"
			}
		}
	}

	// 更新任务信息（包含推送内容）
	push.Name = name
	push.Title = title
	push.Content = content
	push.Payload = payload
	push.PushType = pushType
	push.TargetType = targetType
	push.TargetValue = targetValue
	push.ScheduleTime = scheduleTime
	push.Timezone = timezone
	push.RepeatType = repeatType
	push.RepeatConfig = repeatConfig
	push.CronExpr = cronExpr

	// 更新状态（如果提供了）
	if status != "" {
		push.Status = status
	}

	// 重新计算下次执行时间
	nextRunAt := s.calculateNextRunTime(scheduleTime, repeatType, cronExpr)
	push.NextRunAt = &nextRunAt

	if err := database.DB.Save(&push).Error; err != nil {
		return nil, fmt.Errorf("更新定时推送失败: %v", err)
	}

	return &push, nil
}

// DeleteScheduledPush 删除定时推送
func (s *SchedulerService) DeleteScheduledPush(appID uint, pushID uint) error {
	result := database.DB.Where("app_id = ? AND id = ?", appID, pushID).Delete(&models.ScheduledPush{})
	if result.Error != nil {
		return fmt.Errorf("删除定时推送失败: %v", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("定时推送不存在")
	}
	return nil
}

// PauseScheduledPush 暂停定时推送
func (s *SchedulerService) PauseScheduledPush(appID uint, pushID uint) error {
	result := database.DB.Model(&models.ScheduledPush{}).
		Where("app_id = ? AND id = ? AND status IN ?", appID, pushID, []string{"pending", "running"}).
		Update("status", "paused")

	if result.Error != nil {
		return fmt.Errorf("暂停定时推送失败: %v", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("定时推送不存在或状态不允许暂停")
	}
	return nil
}

// ResumeScheduledPush 恢复定时推送
func (s *SchedulerService) ResumeScheduledPush(appID uint, pushID uint) error {
	var push models.ScheduledPush
	err := database.DB.Where("app_id = ? AND id = ? AND status = ?", appID, pushID, "paused").First(&push).Error
	if err != nil {
		return fmt.Errorf("定时推送不存在或状态不允许恢复")
	}

	// 重新计算下次执行时间
	nextRunAt := s.calculateNextRunTime(push.ScheduleTime, push.RepeatType, push.CronExpr)
	push.NextRunAt = &nextRunAt
	push.Status = "pending" // 恢复后设置为等待中，让调度器重新检查并执行

	if err := database.DB.Save(&push).Error; err != nil {
		return fmt.Errorf("恢复定时推送失败: %v", err)
	}

	return nil
}

// ExecuteScheduledPush 执行定时推送
func (s *SchedulerService) ExecuteScheduledPush(appID uint, pushID uint) error {
	var push models.ScheduledPush
	err := database.DB.Where("app_id = ? AND id = ? AND status IN ?", appID, pushID, []string{"pending", "running"}).First(&push).Error
	if err != nil {
		return fmt.Errorf("定时推送不存在或状态不允许执行")
	}

	// 先执行实际推送
	err = s.executeActualPush(push)
	if err != nil {
		// 推送失败时更新状态
		push.Status = "failed"
		now := utils.TimeNow()
		push.LastRunAt = &now
		database.DB.Save(&push)
		return fmt.Errorf("推送执行失败: %v", err)
	}

	// 推送成功后，更新执行时间和状态
	now := utils.TimeNow()
	push.LastRunAt = &now

	// 计算下次执行时间
	if push.RepeatType != "once" {
		nextRunAt := s.calculateNextRunTime(push.ScheduleTime, push.RepeatType, push.CronExpr)
		push.NextRunAt = &nextRunAt
		// 保持状态为 pending，等待下次执行
	} else {
		// 单次执行的任务，标记为已完成
		push.Status = "completed"
		push.NextRunAt = nil
	}

	// 保存更新
	if err := database.DB.Save(&push).Error; err != nil {
		return fmt.Errorf("更新定时推送状态失败: %v", err)
	}

	return nil
}

// GetPendingSchedules 获取待执行的定时任务
func (s *SchedulerService) GetPendingSchedules() ([]models.ScheduledPush, error) {
	now := utils.TimeNow()

	var pushes []models.ScheduledPush
	err := database.DB.Where("status IN ? AND next_run_at <= ?", []string{"pending", "running"}, now).
		Order("next_run_at ASC").Find(&pushes).Error

	return pushes, err
}

// calculateNextRunTime 计算下次执行时间
func (s *SchedulerService) calculateNextRunTime(scheduleTime time.Time, repeatType, cronExpr string) time.Time {
	now := utils.TimeNow()

	switch repeatType {
	case "once":
		return scheduleTime
	case "daily":
		nextTime := scheduleTime
		for nextTime.Before(now) {
			nextTime = nextTime.AddDate(0, 0, 1)
		}
		return nextTime
	case "weekly":
		nextTime := scheduleTime
		for nextTime.Before(now) {
			nextTime = nextTime.AddDate(0, 0, 7)
		}
		return nextTime
	case "monthly":
		nextTime := scheduleTime
		for nextTime.Before(now) {
			nextTime = nextTime.AddDate(0, 1, 0)
		}
		return nextTime
	default:
		// TODO: 支持 cron 表达式解析
		// 目前返回原始时间
		return scheduleTime
	}
}

// executeActualPush 执行实际的推送操作
func (s *SchedulerService) executeActualPush(push models.ScheduledPush) error {
	pushService := NewPushService()

	// 解析payload
	var payloadMap map[string]interface{}
	if push.Payload != "" && push.Payload != "{}" {
		if err := json.Unmarshal([]byte(push.Payload), &payloadMap); err != nil {
			return fmt.Errorf("payload JSON 解析失败: %v", err)
		}
	}

	// 构建推送目标
	target, err := s.buildPushTarget(push)
	if err != nil {
		return fmt.Errorf("构建推送目标失败: %v", err)
	}

	// 构建推送请求
	pushRequest := PushRequest{
		Title:   push.Title,
		Content: push.Content,
		Payload: payloadMap,
		Target:  target,
		// Schedule 为 nil 表示立即推送
	}

	// 执行推送（使用创建者ID作为用户ID）
	_, err = pushService.SendPush(push.AppID, push.CreatedBy, pushRequest)
	if err != nil {
		return fmt.Errorf("推送发送失败: %v", err)
	}

	return nil
}

// buildPushTarget 根据定时推送配置构建推送目标
func (s *SchedulerService) buildPushTarget(push models.ScheduledPush) (PushTarget, error) {
	target := PushTarget{}

	switch push.TargetType {
	case "all":
		target.Type = "all"
		// 广播推送：检查是否有平台或厂商筛选条件
		if push.TargetValue != "" {
			var filterConfig map[string]interface{}
			if err := json.Unmarshal([]byte(push.TargetValue), &filterConfig); err == nil {
				// 如果target_value是JSON格式，尝试解析筛选条件
				if platform, ok := filterConfig["platform"].(string); ok && platform != "" {
					target.Platform = platform
				}
				if channel, ok := filterConfig["channel"].(string); ok && channel != "" {
					target.Channel = channel
				}
			} else {
				// 如果不是JSON格式，尝试解析简单的字符串格式
				targetValue := strings.TrimSpace(push.TargetValue)
				if targetValue != "" && targetValue != "{}" {
					// 尝试解析 platform:ios 或 channel:xx 格式
					if strings.Contains(targetValue, ":") {
						parts := strings.Split(targetValue, ":")
						if len(parts) == 2 {
							key := strings.TrimSpace(parts[0])
							value := strings.TrimSpace(parts[1])
							if key == "platform" && (value == "ios" || value == "android") {
								target.Platform = value
							} else if key == "channel" {
								target.Channel = value
							}
						}
					} else if targetValue == "ios" || targetValue == "android" {
						// 直接指定平台
						target.Platform = targetValue
					}
				}
			}
		}
	case "devices":
		target.Type = "devices"
		// target_value 可能存储的是JSON数组格式或逗号分隔的token列表
		var deviceIDs []uint
		if push.TargetValue != "" {
			var tokens []string

			// 首先尝试解析JSON数组格式
			if err := json.Unmarshal([]byte(push.TargetValue), &tokens); err != nil {
				// 如果JSON解析失败，尝试按逗号分隔解析
				if strings.Contains(push.TargetValue, ",") {
					// 逗号分隔格式：token1,token2,token3
					tokens = strings.Split(push.TargetValue, ",")
					// 清理每个token的空白字符
					for i, token := range tokens {
						tokens[i] = strings.TrimSpace(token)
					}
				} else {
					// 单个token格式
					tokens = []string{strings.TrimSpace(push.TargetValue)}
				}
			}

			// 过滤掉空的token
			var validTokens []string
			for _, token := range tokens {
				if token != "" {
					validTokens = append(validTokens, token)
				}
			}

			// 根据token列表查询设备ID
			if len(validTokens) > 0 {
				var devices []models.Device
				if err := database.DB.Where("token IN ? AND app_id = ? AND status = 1", validTokens, push.AppID).Find(&devices).Error; err != nil {
					return target, fmt.Errorf("根据设备token查询设备失败: %v", err)
				}

				if len(devices) == 0 {
					return target, fmt.Errorf("未找到有效的设备: token列表 %v 在应用 %d 中不存在或已禁用", validTokens, push.AppID)
				}

				// 提取设备ID
				for _, device := range devices {
					deviceIDs = append(deviceIDs, device.ID)
				}
			}
		}
		target.DeviceIDs = deviceIDs
	case "groups":
		target.Type = "groups"
		// target_config 应该包含分组ID列表
		var groupIDs []uint
		if push.TargetValue != "" {
			if err := json.Unmarshal([]byte(push.TargetValue), &groupIDs); err != nil {
				return target, fmt.Errorf("groups目标配置解析失败: %v", err)
			}
		}
		target.GroupIDs = groupIDs
	case "tags":
		target.Type = "tags"
		// target_config 应该包含标签ID列表
		var tagIDs []uint
		if push.TargetValue != "" {
			if err := json.Unmarshal([]byte(push.TargetValue), &tagIDs); err != nil {
				return target, fmt.Errorf("tags目标配置解析失败: %v", err)
			}
		}
		target.TagIDs = tagIDs
	default:
		return target, fmt.Errorf("不支持的目标类型: %s", push.TargetType)
	}

	return target, nil
}

// startScheduler 启动定时任务调度器
func (s *SchedulerService) startScheduler() {
	ticker := time.NewTicker(30 * time.Second) // 每30秒检查一次
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// 检查并执行到期的定时推送任务
			s.checkAndExecuteScheduledPushes()
		case <-s.stopChan:
			// 停止调度器
			return
		}
	}
}

// checkAndExecuteScheduledPushes 检查并执行到期的定时推送任务
func (s *SchedulerService) checkAndExecuteScheduledPushes() {
	// 获取待执行的任务
	pendingPushes, err := s.GetPendingSchedules()
	if err != nil {
		// 记录错误日志，但不中断调度器
		fmt.Printf("获取待执行任务失败: %v\n", err)
		return
	}

	// 记录检查到的任务数量
	if len(pendingPushes) > 0 {
		fmt.Printf("发现 %d 个待执行的定时推送任务\n", len(pendingPushes))
	}

	// 执行到期的任务
	for _, push := range pendingPushes {
		// 检查任务是否真的到期了
		if push.NextRunAt != nil && push.NextRunAt.Before(utils.TimeNow()) {
			fmt.Printf("执行定时推送任务: ID=%d, 名称=%s, 下次执行时间=%v\n",
				push.ID, push.Name, push.NextRunAt)

			// 异步执行推送任务，避免阻塞调度器
			go func(pushID uint, appID uint, taskName string) {
				fmt.Printf("开始执行定时推送任务: ID=%d, 名称=%s\n", pushID, taskName)
				if err := s.ExecuteScheduledPush(appID, pushID); err != nil {
					fmt.Printf("执行定时推送任务失败 (ID: %d, 名称: %s): %v\n", pushID, taskName, err)
				} else {
					fmt.Printf("定时推送任务执行成功: ID=%d, 名称=%s\n", pushID, taskName)
				}
			}(push.ID, push.AppID, push.Name)
		}
	}
}

// StopScheduler 停止定时任务调度器
func (s *SchedulerService) StopScheduler() {
	close(s.stopChan)
}
