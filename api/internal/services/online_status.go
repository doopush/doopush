package services

import (
	"context"

	"github.com/doopush/doopush/api/internal/models"
	"github.com/redis/go-redis/v9"
)

// onlineKeyPrefix 与 gateway 包内的同名常量保持一致；
// gateway 写入这个 key（device_online:<token>），admin 列表只读
const onlineKeyPrefix = "device_online:"

// EnrichOnlineStatus 用 Redis pipeline 批量查每个 device 的在线态，
// 命中（key exists）→ IsOnline=true；未命中 → IsOnline=false。
// Redis 调用失败时返回错误，不修改 devices 切片，由调用方决定是否容忍 stale。
func EnrichOnlineStatus(ctx context.Context, rdb *redis.Client, devices []models.Device) error {
	if len(devices) == 0 {
		return nil
	}
	pipe := rdb.Pipeline()
	cmds := make([]*redis.IntCmd, len(devices))
	for i, d := range devices {
		cmds[i] = pipe.Exists(ctx, onlineKeyPrefix+d.Token)
	}
	if _, err := pipe.Exec(ctx); err != nil {
		return err
	}
	for i := range devices {
		devices[i].IsOnline = cmds[i].Val() == 1
	}
	return nil
}
