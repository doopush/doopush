package redisclient

import (
	"context"
	"fmt"
	"time"

	"github.com/doopush/doopush/api/internal/config"
	"github.com/redis/go-redis/v9"
)

// New 用环境变量构造 Redis 客户端并 ping 一次。失败时返回 error 由调用方决定容忍策略。
func New() (*redis.Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s",
			config.GetString("REDIS_HOST", "redis"),
			config.GetString("REDIS_PORT", "6379")),
		Password: config.GetString("REDIS_PASSWORD", ""),
		DB:       config.GetInt("REDIS_DB", 0),
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis 连接失败: %w", err)
	}
	return rdb, nil
}
