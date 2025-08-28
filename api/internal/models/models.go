package models

// AllModels 返回所有需要迁移的模型
func AllModels() []interface{} {
	return []interface{}{
		// 用户相关
		&User{},
		&UserAppPermission{},

		// 应用相关
		&App{},
		&AppAPIKey{},
		&AppConfig{},

		// 设备相关
		&Device{},
		&DeviceTagMap{},
		&DeviceGroupMap{},

		// 推送相关
		&PushLog{},
		&PushResult{},
		&PushQueue{},

		// 模板和标签
		&MessageTemplate{},
		&UserTag{},
		&TagDefinition{},
		&DeviceGroup{},

		// 系统功能
		&ScheduledPush{},
		&PushStatistics{},
		&AuditLog{},
		&SystemConfig{},
		&UploadFile{},
		&ExportToken{},
	}
}
