package services

import (
	"testing"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupStatisticsDB 使用东八区作为服务器本地时区（与生产镜像 TZ=Asia/Shanghai 一致）
func setupStatisticsDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousLocal := time.Local
	time.Local = time.FixedZone("CST", 8*3600)
	t.Cleanup(func() { time.Local = previousLocal })

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	if err := db.AutoMigrate(&models.Device{}, &models.PushLog{}, &models.PushStatistics{}); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}

	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })
	return db
}

func TestLocalDayStart(t *testing.T) {
	setupStatisticsDB(t)
	// UTC 2026-10-18 20:00 = 东八区 2026-10-19 04:00
	got := localDayStart(time.Date(2026, 10, 18, 20, 0, 0, 0, time.UTC))
	want := time.Date(2026, 10, 19, 0, 0, 0, 0, time.Local)
	if !got.Equal(want) {
		t.Fatalf("localDayStart = %v, want %v", got, want)
	}
}

func TestSumEngagementIncludesLegacyUTCRows(t *testing.T) {
	db := setupStatisticsDB(t)
	day := time.Date(2026, 10, 19, 0, 0, 0, 0, time.Local)
	rows := []models.PushStatistics{
		{AppID: 1, Date: day, ClickCount: 2, OpenCount: 3},
		// 旧版本按 UTC 零点写入，即东八区当天 08:00
		{AppID: 1, Date: day.Add(8 * time.Hour), ClickCount: 1, OpenCount: 1},
		// 次日和其他应用不计入
		{AppID: 1, Date: day.AddDate(0, 0, 1), ClickCount: 10, OpenCount: 10},
		{AppID: 2, Date: day, ClickCount: 10, OpenCount: 10},
	}
	if err := db.Create(&rows).Error; err != nil {
		t.Fatalf("create statistics: %v", err)
	}

	clicks, opens := sumEngagement(1, day, day.AddDate(0, 0, 1))
	if clicks != 3 || opens != 4 {
		t.Fatalf("sumEngagement = (%d, %d), want (3, 4)", clicks, opens)
	}

	stats := NewPushService().getDailyStats(1, day, day)
	if len(stats) != 1 || stats[0].ClickCount != 3 || stats[0].OpenCount != 4 {
		t.Fatalf("daily stats = %+v, want click 3 open 4", stats)
	}
}

func TestReportPushStatisticsWritesLocalDay(t *testing.T) {
	db := setupStatisticsDB(t)
	device := models.Device{AppID: 1, Token: "token", TokenHash: "hash", Platform: "ios", Channel: "apns", Status: 1}
	if err := db.Create(&device).Error; err != nil {
		t.Fatalf("create device: %v", err)
	}
	pushLog := models.PushLog{AppID: 1, DeviceID: device.ID, Title: "t", Content: "c", Channel: "apns", Status: "sent"}
	if err := db.Create(&pushLog).Error; err != nil {
		t.Fatalf("create push log: %v", err)
	}

	// 东八区 2026-10-19 10:00 和 23:30，同属一个自然日
	ts1 := time.Date(2026, 10, 19, 10, 0, 0, 0, time.Local).Unix()
	ts2 := time.Date(2026, 10, 19, 23, 30, 0, 0, time.Local).Unix()
	service := NewPushService()
	for _, reports := range [][]PushStatisticsEventReport{
		{{PushLogID: pushLog.ID, Event: "click", Timestamp: ts1}, {PushLogID: pushLog.ID, Event: "open", Timestamp: ts1}},
		{{PushLogID: pushLog.ID, Event: "click", Timestamp: ts2}},
	} {
		if err := service.ReportPushStatistics(1, "token", reports); err != nil {
			t.Fatalf("report statistics: %v", err)
		}
	}

	var stats []models.PushStatistics
	db.Find(&stats)
	day := time.Date(2026, 10, 19, 0, 0, 0, 0, time.Local)
	if len(stats) != 1 || !stats[0].Date.Equal(day) || stats[0].ClickCount != 2 || stats[0].OpenCount != 1 {
		t.Fatalf("statistics = %+v, want one row on %v with click 2 open 1", stats, day)
	}

	daily := service.getDailyStats(1, day, day)
	if daily[0].ClickCount != 2 || daily[0].OpenCount != 1 {
		t.Fatalf("daily stats = %+v, want click 2 open 1", daily)
	}
}

func TestReportPushStatisticsIncrementsSingleRowWhenDuplicated(t *testing.T) {
	db := setupStatisticsDB(t)
	device := models.Device{AppID: 1, Token: "token", TokenHash: "hash", Platform: "ios", Channel: "apns", Status: 1}
	if err := db.Create(&device).Error; err != nil {
		t.Fatalf("create device: %v", err)
	}
	pushLog := models.PushLog{AppID: 1, DeviceID: device.ID, Title: "t", Content: "c", Channel: "apns", Status: "sent"}
	if err := db.Create(&pushLog).Error; err != nil {
		t.Fatalf("create push log: %v", err)
	}

	// 同一天已有两条记录（旧版 08:00 记录 + 并发首次写入产生的重复）
	day := time.Date(2026, 10, 19, 0, 0, 0, 0, time.Local)
	rows := []models.PushStatistics{
		{AppID: 1, Date: day.Add(8 * time.Hour), ClickCount: 5, OpenCount: 5},
		{AppID: 1, Date: day, ClickCount: 1, OpenCount: 1},
	}
	if err := db.Create(&rows).Error; err != nil {
		t.Fatalf("create statistics: %v", err)
	}

	ts := day.Add(12 * time.Hour).Unix()
	err := NewPushService().ReportPushStatistics(1, "token", []PushStatisticsEventReport{
		{PushLogID: pushLog.ID, Event: "click", Timestamp: ts},
		{PushLogID: pushLog.ID, Event: "click", Timestamp: ts},
		{PushLogID: pushLog.ID, Event: "open", Timestamp: ts},
	})
	if err != nil {
		t.Fatalf("report statistics: %v", err)
	}

	clicks, opens := sumEngagement(1, day, day.AddDate(0, 0, 1))
	if clicks != 8 || opens != 7 {
		t.Fatalf("sumEngagement = (%d, %d), want (8, 7)", clicks, opens)
	}
	var count int64
	db.Model(&models.PushStatistics{}).Count(&count)
	if count != 2 {
		t.Fatalf("statistics rows = %d, want 2 (no new row)", count)
	}
}

func TestCallbackStatisticsTodayIsLocalMidnight(t *testing.T) {
	setupStatisticsDB(t)
	now := time.Now().In(time.Local)
	want := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	if got := today(); !got.Equal(want) {
		t.Fatalf("today = %v, want %v", got, want)
	}
}
