package logger

import (
	"log"
	"os"
)

// Logger 统一日志管理
var Logger *log.Logger

func init() {
	Logger = log.New(os.Stdout, "[API] ", log.LstdFlags|log.Lshortfile)
}

// Info 信息日志
func Info(v ...interface{}) {
	Logger.Println("[INFO]", v)
}

// Error 错误日志
func Error(v ...interface{}) {
	Logger.Println("[ERROR]", v)
}

// Fatal 致命错误日志
func Fatal(v ...interface{}) {
	Logger.Fatal("[FATAL]", v)
}
