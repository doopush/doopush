package config

import (
	"log"
	"os"

	"github.com/spf13/viper"
)

// LoadConfig 加载配置文件
func LoadConfig(envFile string) {
	viper.SetConfigFile(envFile)
	viper.SetConfigType("env")

	if err := viper.ReadInConfig(); err != nil {
		log.Printf("配置文件读取失败: %v", err)
	}

	log.Printf("配置文件已加载: %s", envFile)

	// 检查是否存在本地覆盖配置文件
	localConfigFile := envFile + ".local"
	if _, err := os.Stat(localConfigFile); err == nil {
		// 本地配置文件存在，合并配置
		viper.SetConfigFile(localConfigFile)
		if err := viper.MergeInConfig(); err != nil {
			log.Printf("本地配置文件合并失败: %v", err)
		} else {
			log.Printf("本地配置文件已合并: %s", localConfigFile)
		}
	} else if !os.IsNotExist(err) {
		log.Printf("检查本地配置文件失败: %v", err)
	}
}

// GetString 获取字符串配置
func GetString(key string, defaultValue ...string) string {
	if viper.IsSet(key) {
		return viper.GetString(key)
	}
	if len(defaultValue) > 0 {
		return defaultValue[0]
	}
	return ""
}

// GetInt 获取整数配置
func GetInt(key string, defaultValue ...int) int {
	if viper.IsSet(key) {
		return viper.GetInt(key)
	}
	if len(defaultValue) > 0 {
		return defaultValue[0]
	}
	return 0
}

// GetBool 获取布尔配置
func GetBool(key string, defaultValue ...bool) bool {
	if viper.IsSet(key) {
		return viper.GetBool(key)
	}
	if len(defaultValue) > 0 {
		return defaultValue[0]
	}
	return false
}

// AuditConfig 审计日志配置结构
type AuditConfig struct {
	RetentionDays   int  `json:"retention_days"`   // 审计日志保留天数
	AutoCleanup     bool `json:"auto_cleanup"`     // 是否开启自动清理
	CleanupInterval int  `json:"cleanup_interval"` // 清理任务执行间隔(小时)
	BatchSize       int  `json:"batch_size"`       // 批量清理大小
}

// GetAuditConfig 获取审计日志配置
func GetAuditConfig() AuditConfig {
	return AuditConfig{
		RetentionDays:   GetInt("AUDIT_RETENTION_DAYS", 365),      // 默认保留1年
		AutoCleanup:     GetBool("AUDIT_AUTO_CLEANUP", true),      // 默认开启自动清理
		CleanupInterval: GetInt("AUDIT_CLEANUP_INTERVAL", 24),     // 默认24小时执行一次
		BatchSize:       GetInt("AUDIT_CLEANUP_BATCH_SIZE", 1000), // 默认每批清理1000条
	}
}

// GetAuditRetentionDays 获取审计日志保留天数
func GetAuditRetentionDays() int {
	return GetInt("AUDIT_RETENTION_DAYS", 365)
}

// IsAuditAutoCleanupEnabled 检查是否开启审计日志自动清理
func IsAuditAutoCleanupEnabled() bool {
	return GetBool("AUDIT_AUTO_CLEANUP", true)
}

// GetAuditCleanupInterval 获取审计日志清理间隔(小时)
func GetAuditCleanupInterval() int {
	return GetInt("AUDIT_CLEANUP_INTERVAL", 24)
}

// GetAuditCleanupBatchSize 获取审计日志清理批次大小
func GetAuditCleanupBatchSize() int {
	return GetInt("AUDIT_CLEANUP_BATCH_SIZE", 1000)
}
