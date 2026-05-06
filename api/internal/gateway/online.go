package gateway

import (
	"context"
	"log"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
	"github.com/redis/go-redis/v9"
)

const (
	onlineKeyPrefix = "device_online:"
	onlineTTL       = 2 * time.Hour
)

// MarkOnline 设置 Redis 在线态 + 更新 MySQL is_online=true
func MarkOnline(rdb *redis.Client, appID uint, token string) {
	ctx := context.Background()
	key := onlineKeyPrefix + token
	if err := rdb.Set(ctx, key, "1", onlineTTL).Err(); err != nil {
		log.Printf("redis set online failed: %v", err)
	}

	// 数据库异步更新
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("db mark online panic token=%s: %v", token, r)
			}
		}()
		now := time.Now()
		tokenHash := utils.HashString(token)
		err := database.DB.Model(&models.Device{}).
			Where("app_id = ? AND token_hash = ?", appID, tokenHash).
			Updates(map[string]interface{}{
				"is_online":      true,
				"last_seen":      &now,
				"last_heartbeat": &now,
			}).Error
		if err != nil {
			log.Printf("db mark online failed token=%s: %v", token, err)
		}
	}()
}

// MarkOffline 删除 Redis 在线态 + 更新 MySQL is_online=false
func MarkOffline(rdb *redis.Client, appID uint, token string) {
	ctx := context.Background()
	key := onlineKeyPrefix + token
	if err := rdb.Del(ctx, key).Err(); err != nil {
		log.Printf("redis del online failed: %v", err)
	}
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("db mark offline panic token=%s: %v", token, r)
			}
		}()
		tokenHash := utils.HashString(token)
		err := database.DB.Model(&models.Device{}).
			Where("app_id = ? AND token_hash = ?", appID, tokenHash).
			Update("is_online", false).Error
		if err != nil {
			log.Printf("db mark offline failed token=%s: %v", token, err)
		}
	}()
}
