# 设备列表在线指示器设计

- **日期**：2026-05-06
- **状态**：设计已确认
- **范围**：admin 设备列表新增"在线/离线"绿点指示器；列名 `最后活跃` → `最后注册`。

## 1. 背景

TCP→WebSocket 迁移完成后（同日），`device.last_seen` 字段语义收窄为"会话开始时间"——只在 SDK 调注册接口和 WS 握手成功时刷新，连接保持期间不刷新。当前 admin UI 的 `最后活跃` 列直读该字段，会让用户误以为设备已离线，但其实可能仍在长连。

为了准确表达"当前在线状态"，引入独立的实时指示器（绿点），数据源是 Redis 的 `device_online:<token>` key（gateway 在 WS 握手成功时写入，断开时删除）。同时把列名校正为"最后注册"，避免歧义。

## 2. 范围与非目标

### 范围
- API 服务接入 Redis client（目前只 gateway 接了）
- 设备列表接口在返回前用 Redis 实时覆写 `is_online` 字段
- 前端 `Device` 类型补 `is_online`
- 设备列表 "设备信息" 列在 emoji 之后、设备名之前加 8px 圆点（在线绿 / 离线灰），hover tooltip 显示"在线/离线"
- 列头 "最后活跃" → "最后注册"

### 非目标
- 不引入 WS 推送/SSE 实现"实时刷新"——用户翻页/手动刷新时重查即可
- 不改 gateway 端逻辑（`MarkOnline`/`MarkOffline` 维持现状）
- 不改 DB schema（`is_online` 列继续由 gateway 维护，但 API 列表以 Redis 为真相覆写）
- 不动 `状态` 列（启用/禁用，与在线状态正交）

## 3. 数据流

```
用户访问设备列表页
   │
   ▼
GET /apps/:id/devices?page=&size=&...
   │
   ▼
DeviceController.GetDevices
   │
   ├──→ DeviceService.GetDevices  → MySQL 取 N 条 Device 记录
   │
   ├──→ Redis pipeline EXISTS device_online:<token1>... <tokenN>
   │
   └──→ 用 Redis 结果**覆写**每条记录的 IsOnline，再 JSON 返回
                │
                ▼
        前端渲染：is_online=true → 绿点；false → 灰点
```

**关键决策**：Redis 是在线态真相。MySQL `is_online` 仍由 gateway 维护（避免重写 gateway 代码），但列表展示路径不依赖它，不会因为 gateway 进程异常导致 stale 数据展示。

## 4. 后端改动

### 4.1 Redis 客户端注入

**文件**：`api/cmd/serve.go`

在 API 服务启动时初始化 Redis client（参考 `gateway/server.go:NewGatewayServer` 的写法），通过 controller 构造函数传入。

**注入路径**：
- `api/cmd/serve.go` 启动期建 `*redis.Client`
- 传给 `controllers.NewDeviceController(deviceService, redisClient)`
- `DeviceController` 结构体新增 `rdb *redis.Client` 字段

### 4.2 列表接口覆写在线态

**文件**：`api/internal/controllers/device_controller.go`

在 `GetDevices` 中，service 返回 `[]models.Device` 后追加：

```go
// 用 Redis 实时覆写 is_online，避免依赖 gateway 写 DB 的 stale 状态
if len(devices) > 0 {
    keys := make([]string, len(devices))
    for i, d := range devices {
        keys[i] = "device_online:" + d.Token
    }
    pipe := d.rdb.Pipeline()
    cmds := make([]*redis.IntCmd, len(keys))
    for i, k := range keys {
        cmds[i] = pipe.Exists(c.Request.Context(), k)
    }
    _, _ = pipe.Exec(c.Request.Context())
    for i := range devices {
        devices[i].IsOnline = cmds[i].Val() == 1
    }
}
```

**性能**：1 次 RTT 不论列表多大；EXISTS 是 O(1)；100 台设备约 0.5ms。Redis 不可用时静默退化（保留 MySQL 原值，不阻断列表）。

### 4.3 单设备接口（可选）

`GetDevice`（按 ID 查单设备）也用同样的方式覆写 `is_online`：调一次 `rdb.Exists(ctx, "device_online:"+device.Token)`，根据结果赋值。同样 swallow error。

## 5. 前端改动

### 5.1 Device 类型补字段

**文件**：`web/src/types/api.ts`

在 `Device` interface 加 `is_online: boolean` 字段。

### 5.2 在线指示器渲染

**文件**：`web/src/features/devices/index.tsx`

在 "设备信息" 列的渲染中，emoji/平台图标之后、设备名之前插入：

```tsx
<span
  className={cn(
    "inline-block size-2 rounded-full",
    device.is_online ? "bg-emerald-500" : "bg-muted-foreground/40"
  )}
  title={device.is_online ? "在线" : "离线"}
/>
```

8px 圆点（`size-2`），在线 emerald-500，离线半透明灰（`muted-foreground/40`）。

### 5.3 列头重命名

`<TableHead>最后活跃</TableHead>` → `<TableHead>最后注册</TableHead>`（行 ~333）。

绑定字段不变（仍是 `device.last_seen`）。

## 6. 错误处理

- **Redis 连接失败 / 超时**：覆写步骤 swallow error；返回 MySQL 原始 `is_online`，前端仍能显示（仅是 stale）。日志一条 warn，不报 5xx。
- **设备数 0**：跳过 Redis 调用。
- **API 启动期 Redis 不可达**：与 gateway 一致 —— `log.Fatal`，让 supervisord 重启。理由：在线指示器是核心管理体验，没有 Redis 等于功能不可用，应硬失败而非半工作。

## 7. 测试

### 后端
- 单测：mock `*redis.Client`（用 `redismock` 或本地 miniredis），验证覆写逻辑正确（在线/离线/Redis错误三态）
- 集成：手动跑 demo app，验证列表绿点状态正确

### 前端
- 视觉：dev 模式下用 mock 数据渲染，确认不同设备的绿/灰点正常
- 真实环境：手动验证

## 8. 上线步骤

1. API 服务部署需要 Redis 连接信息（`REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB`，与 gateway 共用）
2. 前端发版后，列头同步显示"最后注册"

## 9. 风险

| 风险 | 缓解 |
|---|---|
| Redis 抖动导致列表偶尔显示错误状态 | swallow error 退化到 MySQL，stale 不影响功能 |
| 大列表（>1000 台）pipeline 延迟 | EXISTS 是 O(1)，1000 台 pipeline 一般 <5ms；超大列表可由分页限制 |
| `is_online` 字段在 DB 与 Redis 间双源真相 | 文档明确：Redis 是 listing 真相，DB 是 best-effort 缓存 |

## 10. 后续工作（非本次）

- WS 推送/SSE 实现实时刷新（页面长开自动更新点状态）
- 在 admin 顶部展示"在线设备总数 / 总设备数"汇总
