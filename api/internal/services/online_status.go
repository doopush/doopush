package services

import (
	"context"

	"github.com/doopush/doopush/api/internal/models"
	"github.com/redis/go-redis/v9"
)

// OnlineKeyPrefix gateway 写入 device_online:<token>，admin 读
const OnlineKeyPrefix = "device_online:"

// EnrichOnlineStatus 用 Redis pipeline 批量查每个 device 的在线态并就地覆写 IsOnline。
// rdb=nil 或 Redis 调用失败时不修改切片，由调用方决定是否容忍 stale。
func EnrichOnlineStatus(ctx context.Context, rdb *redis.Client, devices []models.Device) error {
	if rdb == nil || len(devices) == 0 {
		return nil
	}
	pipe := rdb.Pipeline()
	cmds := make([]*redis.IntCmd, len(devices))
	for i, d := range devices {
		cmds[i] = pipe.Exists(ctx, OnlineKeyPrefix+d.Token)
	}
	if _, err := pipe.Exec(ctx); err != nil {
		return err
	}
	for i := range devices {
		devices[i].IsOnline = cmds[i].Val() == 1
	}
	return nil
}

// EnrichOnlineStatusOne 单设备版，语义同上。
func EnrichOnlineStatusOne(ctx context.Context, rdb *redis.Client, device *models.Device) error {
	if rdb == nil || device == nil {
		return nil
	}
	n, err := rdb.Exists(ctx, OnlineKeyPrefix+device.Token).Result()
	if err != nil {
		return err
	}
	device.IsOnline = n == 1
	return nil
}
