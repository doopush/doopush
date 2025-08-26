package utils

import (
	"crypto/md5"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"time"
)

// GenerateAPIKey 生成API密钥
func GenerateAPIKey() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

	b := make([]byte, 32)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		b[i] = charset[n.Int64()]
	}
	return string(b)
}

// HashString 字符串哈希 (用于API密钥等)
func HashString(input string) string {
	hash := md5.Sum([]byte(input + "doopush_salt"))
	return fmt.Sprintf("%x", hash)
}

// Contains 检查切片是否包含元素
func Contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// TimeNow 获取当前时间 (方便测试时mock)
func TimeNow() time.Time {
	return time.Now()
}

// RandomBool 生成随机布尔值
func RandomBool(probability float64) bool {
	n, _ := rand.Int(rand.Reader, big.NewInt(100))
	return float64(n.Int64()) < probability*100
}

// StringIsValidJSON 验证字符串是否为有效的 JSON 格式
func StringIsValidJSON(str string) bool {
	var js interface{}
	return json.Unmarshal([]byte(str), &js) == nil
}
