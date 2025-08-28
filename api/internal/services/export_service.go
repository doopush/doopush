package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

// ExportService 导出服务
type ExportService struct{}

// NewExportService 创建导出服务
func NewExportService() *ExportService {
	return &ExportService{}
}

// ExportResult 导出结果
type ExportResult struct {
	DownloadURL string    `json:"download_url"`
	Filename    string    `json:"filename"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// DownloadFile 下载文件信息
type DownloadFile struct {
	Filename    string
	ContentType string
	Data        []byte
}

// PushLogFilters 推送日志过滤器
type PushLogFilters struct {
	Status    string     `json:"status"`
	Platform  string     `json:"platform"`
	Search    string     `json:"search"`
	StartDate *time.Time `json:"start_date"`
	EndDate   *time.Time `json:"end_date"`
}

// StatisticsParams 统计参数
type StatisticsParams struct {
	TimeRange string     `json:"time_range"`
	StartDate *time.Time `json:"start_date"`
	EndDate   *time.Time `json:"end_date"`
}

// ExportPushLogs 导出推送日志
func (s *ExportService) ExportPushLogs(appID uint, userID uint, filters PushLogFilters) (*ExportResult, error) {
	// 检查用户权限
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, appID, "developer")
	if err != nil {
		return nil, fmt.Errorf("权限检查失败: %v", err)
	}
	if !hasPermission {
		return nil, fmt.Errorf("用户无权限访问该应用")
	}

	// 查询推送日志数据
	var pushLogs []models.PushLog
	query := database.DB.Where("app_id = ?", appID).
		Preload("Device").
		Preload("PushResult")

	// 应用过滤器
	if filters.Status != "" && filters.Status != "all" {
		query = query.Where("status = ?", filters.Status)
	}

	if filters.Platform != "" && filters.Platform != "all" {
		query = query.Joins("JOIN devices ON push_logs.device_id = devices.id").
			Where("devices.platform = ?", filters.Platform)
	}

	if filters.Search != "" {
		query = query.Where("title LIKE ? OR content LIKE ?", "%"+filters.Search+"%", "%"+filters.Search+"%")
	}

	if filters.StartDate != nil {
		query = query.Where("created_at >= ?", filters.StartDate)
	}

	if filters.EndDate != nil {
		query = query.Where("created_at <= ?", filters.EndDate)
	}

	if err := query.Find(&pushLogs).Error; err != nil {
		return nil, fmt.Errorf("查询推送日志失败: %v", err)
	}

	// 生成Excel文件
	filename := fmt.Sprintf("push_logs_%s.xlsx", time.Now().Format("20060102_150405"))
	filePath, err := s.generatePushLogsExcel(pushLogs, filename)
	if err != nil {
		return nil, fmt.Errorf("生成Excel文件失败: %v", err)
	}

	// 生成下载令牌
	token, err := s.generateSecureToken()
	if err != nil {
		return nil, fmt.Errorf("生成下载令牌失败: %v", err)
	}

	// 保存令牌信息
	expiresAt := time.Now().Add(24 * time.Hour)
	exportToken := models.ExportToken{
		Token:       token,
		AppID:       appID,
		UserID:      userID,
		FilePath:    filePath,
		Filename:    filename,
		ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		ExpiresAt:   expiresAt,
	}

	if err := database.DB.Create(&exportToken).Error; err != nil {
		// 清理文件
		os.Remove(filePath)
		return nil, fmt.Errorf("保存下载令牌失败: %v", err)
	}

	return &ExportResult{
		DownloadURL: fmt.Sprintf("/export/download/%s", token),
		Filename:    filename,
		ExpiresAt:   expiresAt,
	}, nil
}

// ExportPushStatistics 导出推送统计
func (s *ExportService) ExportPushStatistics(appID uint, userID uint, params StatisticsParams) (*ExportResult, error) {
	// 检查用户权限
	userService := NewUserService()
	hasPermission, err := userService.CheckAppPermission(userID, appID, "developer")
	if err != nil {
		return nil, fmt.Errorf("权限检查失败: %v", err)
	}
	if !hasPermission {
		return nil, fmt.Errorf("用户无权限访问该应用")
	}

	// 计算时间范围
	endDate := time.Now()
	var startDate time.Time

	if params.StartDate != nil && params.EndDate != nil {
		startDate = *params.StartDate
		endDate = *params.EndDate
	} else {
		switch params.TimeRange {
		case "7d":
			startDate = endDate.AddDate(0, 0, -7)
		case "30d":
			startDate = endDate.AddDate(0, 0, -30)
		case "90d":
			startDate = endDate.AddDate(0, 0, -90)
		default:
			startDate = endDate.AddDate(0, 0, -30)
		}
	}

	// 生成Excel文件
	filename := fmt.Sprintf("push_statistics_%s_%s.xlsx",
		startDate.Format("20060102"),
		endDate.Format("20060102"))
	filePath, err := s.generateStatisticsExcel(appID, startDate, endDate, filename)
	if err != nil {
		return nil, fmt.Errorf("生成Excel文件失败: %v", err)
	}

	// 生成下载令牌
	token, err := s.generateSecureToken()
	if err != nil {
		return nil, fmt.Errorf("生成下载令牌失败: %v", err)
	}

	// 保存令牌信息
	expiresAt := time.Now().Add(24 * time.Hour)
	exportToken := models.ExportToken{
		Token:       token,
		AppID:       appID,
		UserID:      userID,
		FilePath:    filePath,
		Filename:    filename,
		ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		ExpiresAt:   expiresAt,
	}

	if err := database.DB.Create(&exportToken).Error; err != nil {
		// 清理文件
		os.Remove(filePath)
		return nil, fmt.Errorf("保存下载令牌失败: %v", err)
	}

	return &ExportResult{
		DownloadURL: fmt.Sprintf("/export/download/%s", token),
		Filename:    filename,
		ExpiresAt:   expiresAt,
	}, nil
}

// GetDownloadFile 获取下载文件
func (s *ExportService) GetDownloadFile(token string) (*DownloadFile, error) {
	var exportToken models.ExportToken
	if err := database.DB.Where("token = ?", token).First(&exportToken).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("下载链接无效或已过期")
		}
		return nil, fmt.Errorf("查询下载令牌失败: %v", err)
	}

	// 检查是否过期
	if exportToken.IsExpired() {
		// 清理过期令牌和文件
		s.cleanupExpiredToken(&exportToken)
		return nil, fmt.Errorf("下载链接已过期")
	}

	// 读取文件
	data, err := os.ReadFile(exportToken.FilePath)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %v", err)
	}

	return &DownloadFile{
		Filename:    exportToken.Filename,
		ContentType: exportToken.ContentType,
		Data:        data,
	}, nil
}

// CleanupExpiredFiles 清理过期文件
func (s *ExportService) CleanupExpiredFiles() error {
	var expiredTokens []models.ExportToken
	if err := database.DB.Where("expires_at < ?", time.Now()).Find(&expiredTokens).Error; err != nil {
		return fmt.Errorf("查询过期令牌失败: %v", err)
	}

	for _, token := range expiredTokens {
		s.cleanupExpiredToken(&token)
	}

	return nil
}

// generateSecureToken 生成安全令牌
func (s *ExportService) generateSecureToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// cleanupExpiredToken 清理过期令牌
func (s *ExportService) cleanupExpiredToken(token *models.ExportToken) {
	// 删除文件
	if _, err := os.Stat(token.FilePath); err == nil {
		os.Remove(token.FilePath)
	}

	// 删除数据库记录
	database.DB.Delete(token)
}

// ensureExportDir 确保导出目录存在
func (s *ExportService) ensureExportDir() (string, error) {
	exportDir := filepath.Join("uploads", "tmp", "exports")
	if err := os.MkdirAll(exportDir, 0755); err != nil {
		return "", fmt.Errorf("创建导出目录失败: %v", err)
	}
	return exportDir, nil
}

// generatePushLogsExcel 生成推送日志Excel文件
func (s *ExportService) generatePushLogsExcel(pushLogs []models.PushLog, filename string) (string, error) {
	// 确保导出目录存在
	exportDir, err := s.ensureExportDir()
	if err != nil {
		return "", err
	}

	filePath := filepath.Join(exportDir, filename)

	// 创建Excel文件
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			fmt.Printf("关闭Excel文件失败: %v\n", err)
		}
	}()

	// 设置工作表名称
	sheetName := "推送历史"
	f.SetSheetName("Sheet1", sheetName)

	// 设置表头
	headers := []string{
		"推送ID", "推送标题", "推送内容", "目标类型", "设备数量",
		"成功数量", "失败数量", "成功率", "平台", "状态", "发送时间", "创建时间",
	}

	// 写入表头
	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	// 设置表头样式
	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#E6E6FA"},
			Pattern: 1,
		},
	})
	if err == nil {
		f.SetCellStyle(sheetName, "A1", fmt.Sprintf("%c1", 'A'+len(headers)-1), headerStyle)
	}

	// 写入数据
	for i, log := range pushLogs {
		row := i + 2

		// 计算成功率
		successRate := "0%"
		if log.PushResult != nil {
			if log.PushResult.Success {
				successRate = "100%"
			}
		}

		// 获取平台信息
		platform := "未知"
		if log.Device.Platform != "" {
			platform = log.Device.Platform
		}

		// 格式化时间
		sendTime := ""
		if log.SendAt != nil {
			sendTime = log.SendAt.Format("2006-01-02 15:04:05")
		}

		// 写入行数据
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), log.ID)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), log.Title)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), log.Content)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), "指定设备") // 简化处理
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), 1)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), func() int {
			if log.PushResult != nil && log.PushResult.Success {
				return 1
			}
			return 0
		}())
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), func() int {
			if log.PushResult != nil && !log.PushResult.Success {
				return 1
			}
			return 0
		}())
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), successRate)
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), platform)
		f.SetCellValue(sheetName, fmt.Sprintf("J%d", row), log.Status)
		f.SetCellValue(sheetName, fmt.Sprintf("K%d", row), sendTime)
		f.SetCellValue(sheetName, fmt.Sprintf("L%d", row), log.CreatedAt.Format("2006-01-02 15:04:05"))
	}

	// 自动调整列宽
	for i := 0; i < len(headers); i++ {
		col := fmt.Sprintf("%c", 'A'+i)
		f.SetColWidth(sheetName, col, col, 15)
	}

	// 保存文件
	if err := f.SaveAs(filePath); err != nil {
		return "", fmt.Errorf("保存Excel文件失败: %v", err)
	}

	return filePath, nil
}

// generateStatisticsExcel 生成统计Excel文件
func (s *ExportService) generateStatisticsExcel(appID uint, startDate, endDate time.Time, filename string) (string, error) {
	// 确保导出目录存在
	exportDir, err := s.ensureExportDir()
	if err != nil {
		return "", err
	}

	filePath := filepath.Join(exportDir, filename)

	// 创建Excel文件
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			fmt.Printf("关闭Excel文件失败: %v\n", err)
		}
	}()

	// 生成总体统计表
	if err := s.generateOverviewSheet(f, appID, startDate, endDate); err != nil {
		return "", fmt.Errorf("生成总体统计表失败: %v", err)
	}

	// 生成每日数据表
	if err := s.generateDailyDataSheet(f, appID, startDate, endDate); err != nil {
		return "", fmt.Errorf("生成每日数据表失败: %v", err)
	}

	// 生成平台分布表
	if err := s.generatePlatformDistributionSheet(f, appID, startDate, endDate); err != nil {
		return "", fmt.Errorf("生成平台分布表失败: %v", err)
	}

	// 保存文件
	if err := f.SaveAs(filePath); err != nil {
		return "", fmt.Errorf("保存Excel文件失败: %v", err)
	}

	return filePath, nil
}

// generateOverviewSheet 生成总体统计表
func (s *ExportService) generateOverviewSheet(f *excelize.File, appID uint, startDate, endDate time.Time) error {
	sheetName := "总体统计"
	f.SetSheetName("Sheet1", sheetName)

	// 查询统计数据
	var totalPush, successPush, failedPush int64

	// 总推送数（与前端逻辑保持一致）
	database.DB.Model(&models.PushLog{}).
		Where("app_id = ? AND created_at >= ?", appID, startDate).
		Count(&totalPush)

	// 成功推送数（与前端逻辑保持一致）
	database.DB.Model(&models.PushLog{}).
		Where("app_id = ? AND status = 'sent' AND created_at >= ?", appID, startDate).
		Count(&successPush)

	// 失败推送数（与前端逻辑保持一致）
	database.DB.Model(&models.PushLog{}).
		Where("app_id = ? AND status = 'failed' AND created_at >= ?", appID, startDate).
		Count(&failedPush)

	// 计算成功率
	successRate := float64(0)
	if totalPush > 0 {
		successRate = float64(successPush) / float64(totalPush) * 100
	}

	// 活跃设备数（与前端显示逻辑保持一致）
	var activeDevices int64
	database.DB.Model(&models.Device{}).
		Where("app_id = ? AND status = 1", appID).
		Count(&activeDevices)

	// 设置表头和数据
	data := [][]interface{}{
		{"统计项目", "数值"},
		{"总推送数", totalPush},
		{"成功推送数", successPush},
		{"失败推送数", failedPush},
		{"成功率", fmt.Sprintf("%.2f%%", successRate)},
		{"活跃设备数", activeDevices},
		{"总点击数", 0},   // 暂时设为0，需要根据实际业务逻辑调整
		{"总打开数", 0},   // 暂时设为0，需要根据实际业务逻辑调整
		{"点击率", "0%"}, // 暂时设为0，需要根据实际业务逻辑调整
		{"打开率", "0%"}, // 暂时设为0，需要根据实际业务逻辑调整
	}

	// 写入数据
	for i, row := range data {
		for j, value := range row {
			cell := fmt.Sprintf("%c%d", 'A'+j, i+1)
			f.SetCellValue(sheetName, cell, value)
		}
	}

	// 设置表头样式
	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#E6E6FA"},
			Pattern: 1,
		},
	})
	if err == nil {
		f.SetCellStyle(sheetName, "A1", "B1", headerStyle)
	}

	// 调整列宽
	f.SetColWidth(sheetName, "A", "A", 20)
	f.SetColWidth(sheetName, "B", "B", 15)

	return nil
}

// generateDailyDataSheet 生成每日数据表
func (s *ExportService) generateDailyDataSheet(f *excelize.File, appID uint, startDate, endDate time.Time) error {
	sheetName := "每日数据"
	f.NewSheet(sheetName)

	// 设置表头
	headers := []string{"日期", "总推送数", "成功推送数", "失败推送数", "点击数", "打开数"}
	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	// 设置表头样式
	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#E6E6FA"},
			Pattern: 1,
		},
	})
	if err == nil {
		f.SetCellStyle(sheetName, "A1", fmt.Sprintf("%c1", 'A'+len(headers)-1), headerStyle)
	}

	// 生成每日数据
	current := startDate
	row := 2
	for current.Before(endDate) || current.Equal(endDate) {
		nextDay := current.AddDate(0, 0, 1)

		// 查询当日数据
		var totalPush, successPush, failedPush int64

		database.DB.Model(&models.PushLog{}).
			Where("app_id = ? AND created_at >= ? AND created_at < ?", appID, current, nextDay).
			Count(&totalPush)

		database.DB.Model(&models.PushLog{}).
			Where("app_id = ? AND status = 'sent' AND created_at >= ? AND created_at < ?", appID, current, nextDay).
			Count(&successPush)

		database.DB.Model(&models.PushLog{}).
			Where("app_id = ? AND status = 'failed' AND created_at >= ? AND created_at < ?", appID, current, nextDay).
			Count(&failedPush)

		// 写入数据
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), current.Format("2006-01-02"))
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), totalPush)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), successPush)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), failedPush)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), 0) // 点击数暂时为0
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), 0) // 打开数暂时为0

		current = nextDay
		row++
	}

	// 调整列宽
	for i := 0; i < len(headers); i++ {
		col := fmt.Sprintf("%c", 'A'+i)
		f.SetColWidth(sheetName, col, col, 15)
	}

	return nil
}

// generatePlatformDistributionSheet 生成平台分布表
func (s *ExportService) generatePlatformDistributionSheet(f *excelize.File, appID uint, startDate, endDate time.Time) error {
	sheetName := "平台分布"
	f.NewSheet(sheetName)

	// 设置表头
	headers := []string{"平台", "推送数量", "成功数量", "失败数量", "成功率"}
	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	// 设置表头样式
	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#E6E6FA"},
			Pattern: 1,
		},
	})
	if err == nil {
		f.SetCellStyle(sheetName, "A1", fmt.Sprintf("%c1", 'A'+len(headers)-1), headerStyle)
	}

	// 查询平台数据
	platforms := []string{"ios", "android"}
	row := 2

	for _, platform := range platforms {
		var totalPush, successPush, failedPush int64

		// 总推送数（与前端逻辑保持一致）
		database.DB.Model(&models.PushLog{}).
			Joins("JOIN devices ON push_logs.device_id = devices.id").
			Where("push_logs.app_id = ? AND devices.platform = ? AND push_logs.created_at >= ?",
				appID, platform, startDate).
			Count(&totalPush)

		// 成功推送数（与前端逻辑保持一致）
		database.DB.Model(&models.PushLog{}).
			Joins("JOIN devices ON push_logs.device_id = devices.id").
			Where("push_logs.app_id = ? AND devices.platform = ? AND push_logs.status = 'sent' AND push_logs.created_at >= ?",
				appID, platform, startDate).
			Count(&successPush)

		// 失败推送数（与前端逻辑保持一致）
		database.DB.Model(&models.PushLog{}).
			Joins("JOIN devices ON push_logs.device_id = devices.id").
			Where("push_logs.app_id = ? AND devices.platform = ? AND push_logs.status = 'failed' AND push_logs.created_at >= ?",
				appID, platform, startDate).
			Count(&failedPush)

		// 计算成功率
		successRate := "0%"
		if totalPush > 0 {
			rate := float64(successPush) / float64(totalPush) * 100
			successRate = fmt.Sprintf("%.2f%%", rate)
		}

		// 写入数据
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), platform)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), totalPush)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), successPush)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), failedPush)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), successRate)

		row++
	}

	// 调整列宽
	for i := 0; i < len(headers); i++ {
		col := fmt.Sprintf("%c", 'A'+i)
		f.SetColWidth(sheetName, col, col, 15)
	}

	return nil
}

// StartCleanupScheduler 启动清理调度器
func (s *ExportService) StartCleanupScheduler() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour) // 每小时执行一次
		defer ticker.Stop()

		for range ticker.C {
			if err := s.CleanupExpiredFiles(); err != nil {
				fmt.Printf("清理过期文件失败: %v\n", err)
			}
		}
	}()
}
