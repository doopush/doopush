package services

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/redis/go-redis/v9"
)

func TestEnrichOnlineStatus_MixedStates(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	defer mr.Close()

	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	mr.Set("device_online:tokA", "1")

	devices := []models.Device{
		{Token: "tokA", IsOnline: false},
		{Token: "tokB", IsOnline: true},
		{Token: "tokC", IsOnline: false},
	}

	if err := EnrichOnlineStatus(context.Background(), rdb, devices); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !devices[0].IsOnline {
		t.Errorf("tokA should be online")
	}
	if devices[1].IsOnline {
		t.Errorf("tokB should be offline (Redis miss overrides DB)")
	}
	if devices[2].IsOnline {
		t.Errorf("tokC should be offline")
	}
}

func TestEnrichOnlineStatus_EmptyList(t *testing.T) {
	mr, _ := miniredis.Run()
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	if err := EnrichOnlineStatus(context.Background(), rdb, nil); err != nil {
		t.Fatalf("nil slice unexpected error: %v", err)
	}
	if err := EnrichOnlineStatus(context.Background(), rdb, []models.Device{}); err != nil {
		t.Fatalf("empty slice unexpected error: %v", err)
	}
}

func TestEnrichOnlineStatus_RedisDown(t *testing.T) {
	mr, _ := miniredis.Run()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()
	mr.Close()

	devices := []models.Device{{Token: "tokA", IsOnline: true}}
	err := EnrichOnlineStatus(context.Background(), rdb, devices)
	if err == nil {
		t.Fatalf("expected error when Redis unreachable")
	}
	if !devices[0].IsOnline {
		t.Errorf("on Redis error, IsOnline should remain DB value (true)")
	}
}

func TestEnrichOnlineStatusOne(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	mr.Set("device_online:hit", "1")

	hit := &models.Device{Token: "hit", IsOnline: false}
	if err := EnrichOnlineStatusOne(context.Background(), rdb, hit); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !hit.IsOnline {
		t.Errorf("hit token should be online")
	}

	miss := &models.Device{Token: "miss", IsOnline: true}
	if err := EnrichOnlineStatusOne(context.Background(), rdb, miss); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if miss.IsOnline {
		t.Errorf("miss token should override DB to offline")
	}

	// nil rdb / nil device → no-op
	if err := EnrichOnlineStatusOne(context.Background(), nil, hit); err != nil {
		t.Errorf("nil rdb should be no-op, got %v", err)
	}
	if err := EnrichOnlineStatusOne(context.Background(), rdb, nil); err != nil {
		t.Errorf("nil device should be no-op, got %v", err)
	}
}
