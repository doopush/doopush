package config

import (
	"log"

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
