# 设备列表在线指示器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 admin 设备列表中以绿点指示设备实时在线（数据源 Redis），并把列名 `最后活跃` 改为 `最后注册`。

**Architecture:** API 服务启动时初始化 Redis client（与 gateway 共用 Redis），注入 `DeviceController`。`GetDevices` / `GetDevice` 在返回前用 Redis pipeline `EXISTS device_online:<token>` 实时覆写每条记录的 `is_online`。前端 `Device` type 加 `is_online`，"设备信息"列在 emoji 之后、设备名之前加 8px 圆点（在线绿/离线灰），列头改名。

**Tech Stack:** Go 1.24 / `redis/go-redis/v9` / `alicebob/miniredis/v2`（test dep）/ React + shadcn/ui / Tailwind

**Spec:** `docs/superpowers/specs/2026-05-06-online-indicator-design.md`

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `api/internal/services/online_status.go` | **新增**：`EnrichOnlineStatus` helper，给一批 device 用 Redis pipeline 覆写 `IsOnline` |
| `api/internal/services/online_status_test.go` | **新增**：miniredis 驱动的单测 |
| `api/cmd/serve.go` | **修改**：启动期初始化 Redis client，传给 `NewDeviceController` |
| `api/internal/controllers/device_controller.go` | **修改**：`DeviceController` 加 `rdb *redis.Client` 字段；`NewDeviceController` 收 Redis 参数；`GetDevices` 和 `GetDevice` 调 `EnrichOnlineStatus` |
| `api/go.mod` / `api/go.sum` | **修改**：新增 `alicebob/miniredis/v2` test dep |
| `web/src/types/api.ts` | **修改**：`Device` interface 加 `is_online: boolean` |
| `web/src/features/devices/index.tsx` | **修改**：列头改名 + 设备名前加圆点指示器 |

---

## Task 1：`EnrichOnlineStatus` helper（TDD）

**目标**：写一个独立的 service 函数，接收 Redis client + device 列表，用 pipeline 批量校验在线态并覆写 `IsOnline`。先写测试再实现。

**Files:**
- Create: `api/internal/services/online_status.go`
- Create: `api/internal/services/online_status_test.go`
- Modify: `api/go.mod`

- [ ] **Step 1：添加 miniredis 测试依赖**

```bash
cd /home/coder/workspaces/doopush/api
go get github.com/alicebob/miniredis/v2@latest
go mod tidy
```

- [ ] **Step 2：写失败测试**

创建 `api/internal/services/online_status_test.go`：

```go
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

	// 设备 A 在线，设备 B 离线，设备 C 离线
	mr.Set("device_online:tokA", "1")

	devices := []models.Device{
		{Token: "tokA", IsOnline: false}, // DB 旧值，期望覆写为 true
		{Token: "tokB", IsOnline: true},  // DB stale，期望覆写为 false
		{Token: "tokC", IsOnline: false}, // 一致
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

	// 空列表不应触发任何 Redis 调用
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
	mr.Close() // 立即关 Redis 模拟连接错误

	devices := []models.Device{{Token: "tokA", IsOnline: true}}
	err := EnrichOnlineStatus(context.Background(), rdb, devices)
	if err == nil {
		t.Fatalf("expected error when Redis unreachable")
	}
	// 错误时不应改变 IsOnline 字段（保留 DB 原值）
	if !devices[0].IsOnline {
		t.Errorf("on Redis error, IsOnline should remain DB value (true)")
	}
}
```

- [ ] **Step 3：跑测试，确认失败**

```bash
cd /home/coder/workspaces/doopush/api
go test ./internal/services/... -run TestEnrichOnlineStatus -v
```

预期：FAIL（`EnrichOnlineStatus` 未定义）。

- [ ] **Step 4：实现 online_status.go**

创建 `api/internal/services/online_status.go`：

```go
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
```

- [ ] **Step 5：跑测试，确认通过**

```bash
cd /home/coder/workspaces/doopush/api
go test ./internal/services/... -run TestEnrichOnlineStatus -v
```

预期：3 个子测试全 PASS。

- [ ] **Step 6：commit**

```bash
git add api/internal/services/online_status.go api/internal/services/online_status_test.go api/go.mod api/go.sum
git commit -m "feat(devices): EnrichOnlineStatus helper 用 Redis 批量覆写 is_online"
```

---

## Task 2：API 服务接 Redis client + DeviceController 注入

**目标**：API 启动时建 Redis client，传给 `NewDeviceController`。其他 controller 不动（不需要 Redis）。

**Files:**
- Modify: `api/cmd/serve.go`
- Modify: `api/internal/controllers/device_controller.go`

- [ ] **Step 1：修改 DeviceController 构造**

打开 `api/internal/controllers/device_controller.go` (第 14-24 行)，修改：

```go
// before:
type DeviceController struct {
	deviceService *services.DeviceService
}

func NewDeviceController() *DeviceController {
	return &DeviceController{
		deviceService: services.NewDeviceService(),
	}
}

// after:
type DeviceController struct {
	deviceService *services.DeviceService
	rdb           *redis.Client
}

func NewDeviceController(rdb *redis.Client) *DeviceController {
	return &DeviceController{
		deviceService: services.NewDeviceService(),
		rdb:           rdb,
	}
}
```

import 段加 `"github.com/redis/go-redis/v9"`。

- [ ] **Step 2：在 serve.go 启动 Redis client**

打开 `api/cmd/serve.go`，在 `startServer` 函数 import 段加 `"github.com/redis/go-redis/v9"`、`"context"`、`"fmt"`、`"time"`（如已存在跳过）。

定位第 71 行 `deviceCtrl := controllers.NewDeviceController()`，在它**之前**插入 Redis 初始化：

```go
	// Redis 客户端（设备在线指示器查询）
	rdb := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s",
			config.GetString("REDIS_HOST", "redis"),
			config.GetString("REDIS_PORT", "6379")),
		Password: config.GetString("REDIS_PASSWORD", ""),
		DB:       config.GetInt("REDIS_DB", 0),
	})
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := rdb.Ping(pingCtx).Err(); err != nil {
		cancel()
		log.Fatalf("Redis 连接失败: %v", err)
	}
	cancel()
```

并把 `deviceCtrl := controllers.NewDeviceController()` 改成 `deviceCtrl := controllers.NewDeviceController(rdb)`。

- [ ] **Step 3：编译验证**

```bash
cd /home/coder/workspaces/doopush/api
go build ./...
```

预期：编译通过。

- [ ] **Step 4：commit**

```bash
git add api/cmd/serve.go api/internal/controllers/device_controller.go
git commit -m "feat(api): API 服务接入 Redis client，注入 DeviceController"
```

---

## Task 3：`GetDevices` / `GetDevice` 调用 enrichment

**目标**：列表接口和详情接口在响应前用 `EnrichOnlineStatus` 覆写 `is_online`。Redis 抖动时 swallow error，保留 DB 原值。

**Files:**
- Modify: `api/internal/controllers/device_controller.go`

- [ ] **Step 1：修改 GetDevices**

打开 `api/internal/controllers/device_controller.go`，定位 `GetDevices` 函数（第 124 行起）。在 `devices, total, err := d.deviceService.GetDevices(...)` 之后、`response.Success(...)` 之前插入 enrichment 调用：

```go
	userID := c.GetUint("user_id")
	devices, total, err := d.deviceService.GetDevices(uint(appID), userID, page, pageSize, platform, status)
	if err != nil {
		if err.Error() == "无权限访问该应用" {
			response.Forbidden(c, err.Error())
		} else {
			response.InternalServerError(c, err.Error())
		}
		return
	}

	// 用 Redis 实时覆写 is_online；失败仅记录、不阻断列表
	if err := services.EnrichOnlineStatus(c.Request.Context(), d.rdb, devices); err != nil {
		log.Printf("EnrichOnlineStatus failed: %v", err)
	}

	response.Success(c, utils.NewPaginationResponse(page, pageSize, total, gin.H{
		"items": devices,
	}))
```

注意：`devices` 类型是 `[]models.Device`（service 返回值，参考 `device_service.go` 第 140-174 行 GetDevices 签名）。

- [ ] **Step 2：修改 GetDevice**

定位 `GetDevice` 函数（第 160 行起，单设备查询）。`device, err := d.deviceService.GetDevice(...)` 调用之后、返回响应之前，插入：

```go
	// Redis 实时覆写
	if device != nil && d.rdb != nil {
		key := "device_online:" + device.Token
		exists, err := d.rdb.Exists(c.Request.Context(), key).Result()
		if err != nil {
			log.Printf("Redis Exists failed for device %d: %v", device.ID, err)
		} else {
			device.IsOnline = exists == 1
		}
	}
```

如果 `GetDevice` 中 device 是按值返回（非指针），调整为操作返回值的指针 `&device`。先确认 service 签名后选合适的写法。

- [ ] **Step 3：编译验证**

```bash
cd /home/coder/workspaces/doopush/api
go build ./...
```

预期：编译通过。

- [ ] **Step 4：手动运行测试通过**

```bash
go test ./internal/services/... -run TestEnrichOnlineStatus -v
go test -race ./internal/gateway/... -v
```

预期：全 PASS（既有的 gateway 测试也不应被破坏）。

- [ ] **Step 5：commit**

```bash
git add api/internal/controllers/device_controller.go
git commit -m "feat(devices): GetDevices/GetDevice 用 Redis 覆写在线态"
```

---

## Task 4：前端 `Device` type 补 `is_online`

**目标**：前端类型定义同步后端响应字段。

**Files:**
- Modify: `web/src/types/api.ts`

- [ ] **Step 1：修改 Device interface**

打开 `web/src/types/api.ts`，定位 `Device` interface（第 67-83 行）。在 `status: number` 后插入 `is_online: boolean`：

```typescript
// before:
export interface Device {
  id: number
  app_id: number
  token: string
  platform: 'ios' | 'android'
  channel: string
  brand: string
  model: string
  system_version: string
  app_version: string
  user_agent: string
  status: number
  last_seen: string
  created_at: string
  updated_at: string
  app?: App
}

// after:
export interface Device {
  id: number
  app_id: number
  token: string
  platform: 'ios' | 'android'
  channel: string
  brand: string
  model: string
  system_version: string
  app_version: string
  user_agent: string
  status: number
  is_online: boolean
  last_seen: string
  created_at: string
  updated_at: string
  app?: App
}
```

- [ ] **Step 2：commit**

```bash
git add web/src/types/api.ts
git commit -m "feat(web): Device 类型补 is_online 字段"
```

---

## Task 5：前端列表渲染圆点 + 列名改名

**目标**：在设备名前面加 8px 圆点（在线绿/离线灰），列头 "最后活跃" 改为 "最后注册"，鼠标悬浮 tooltip 显示在线/离线。

**Files:**
- Modify: `web/src/features/devices/index.tsx`

- [ ] **Step 1：修改列头**

定位 `web/src/features/devices/index.tsx` 第 335 行：

```tsx
// before:
<TableHead>最后活跃</TableHead>

// after:
<TableHead>最后注册</TableHead>
```

- [ ] **Step 2：在设备名前加圆点指示器**

定位第 374-385 行渲染设备名的部分：

```tsx
// before:
<div>
  <div className="font-medium">{device.model}</div>
  <div className="text-sm text-muted-foreground font-mono">
    {device.token.length > 20 
      ? `${device.token.slice(0, 20)}...`
      : device.token
    }
  </div>
  <div className="text-xs text-muted-foreground">
    {device.app_version} • {device.system_version}
  </div>
</div>

// after:
<div>
  <div className="font-medium flex items-center gap-2">
    <span
      className={cn(
        "inline-block size-2 rounded-full shrink-0",
        device.is_online ? "bg-emerald-500" : "bg-muted-foreground/40"
      )}
      title={device.is_online ? "在线" : "离线"}
    />
    <span>{device.model}</span>
  </div>
  <div className="text-sm text-muted-foreground font-mono">
    {device.token.length > 20 
      ? `${device.token.slice(0, 20)}...`
      : device.token
    }
  </div>
  <div className="text-xs text-muted-foreground">
    {device.app_version} • {device.system_version}
  </div>
</div>
```

注意：
- `cn` 应该已经从 `@/lib/utils` 之类的地方 import 了；如果没有，加 `import { cn } from '@/lib/utils'`
- `size-2` 在 Tailwind v4 = 8px × 8px
- `bg-emerald-500` 是绿色，`bg-muted-foreground/40` 是 40% 透明度的灰
- `shrink-0` 防止 flex 容器把圆点压扁

- [ ] **Step 3：lint / 类型检查**

```bash
cd /home/coder/workspaces/doopush/web
npm run lint 2>&1 | tail -20
```

预期：无报错（如有 cn 未 import 报错，按提示加 import 后重试）。

如果 `web/` 用的不是 npm（看 package.json 是 npm/pnpm/bun/yarn 哪个），用对应工具。

- [ ] **Step 4：commit**

```bash
git add web/src/features/devices/index.tsx
git commit -m "feat(web): 设备列表前加在线指示圆点，列名改为最后注册"
```

---

## Task 6：手动联调

**目标**：用真实环境验证前后端打通。

**Files:** none

- [ ] **Step 1：重启 API 服务**

```bash
sudo supervisorctl restart doopush-api
```

或开发模式：

```bash
cd api && go run . serve
```

确认 Redis 连接成功（log 不应出现 `Redis 连接失败` fatal）。

- [ ] **Step 2：前端 dev 模式打开设备列表页**

```bash
cd web
npm run dev
```

打开 admin 设备列表，肉眼检查：
- 在 SDK demo 在线时，对应设备名前是绿点
- 在 SDK demo 离线（杀进程或断网）时，刷新列表，对应设备变灰点
- 列头显示 "最后注册" 而不是 "最后活跃"

- [ ] **Step 3：边界场景**

- 多个设备同时在线：所有在线设备都显示绿点
- 删除某设备的 Redis key（`redis-cli DEL device_online:<token>`），刷新页面 → 该设备变灰点
- 关闭 Redis（`sudo systemctl stop redis` 或 `redis-cli SHUTDOWN`）→ API 重启会失败（按 spec §6 设计）；或者已运行的 API 在调用列表时会 log warn 并退化到 DB 值（不会 5xx）。
- 重新打开 Redis 后恢复正常。

无需 commit（仅手动验证）。

---

## 验收清单

- [ ] `EnrichOnlineStatus` 单测 3 个全 PASS（含 Redis down 场景）
- [ ] API 服务启动期 Redis ping 成功；失败 fatal 而非 warn
- [ ] 设备列表 API 返回的 `is_online` 与 Redis 真相一致（不依赖 DB stale 字段）
- [ ] 前端 Device type 含 `is_online: boolean`
- [ ] 设备列表页设备名前显示绿/灰圆点，hover 显示在线/离线
- [ ] 列头显示 "最后注册"
- [ ] gateway 既有单测仍通过（不被破坏）

---

## 自检清单（writing-plans skill）

- **Spec 覆盖**：spec §3 数据流 → T1+T3；§4.1 注入 → T2；§4.2 覆写 → T3；§4.3 单设备 → T3 Step 2；§5.1 type → T4；§5.2 圆点 → T5；§5.3 改名 → T5；§6 错误处理 → T1 测试 + T3 swallow + T2 fatal；§7 测试 → T1 单测 + T6 手动。
- **占位符**：每个 step 都有具体代码或具体命令，无 TODO / TBD。
- **类型一致**：`EnrichOnlineStatus(ctx, rdb, devices)` 在 T1 和 T3 调用一致；`is_online` / `IsOnline` 字段名贯穿前后端。
- **范围**：单一目标（在线指示器 + 列名），适合单计划。
