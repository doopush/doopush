# TCP → WebSocket 迁移设计

- **日期**：2026-05-06
- **状态**：设计已确认，待落实施计划
- **作者**：DooPush 团队
- **范围**：将 SDK ↔ 平台之间的长连接从自定义 TCP 协议整体替换为 WebSocket。无向后兼容包袱，TCP 代码整段删除。

## 1. 背景与动机

DooPush 推送平台目前通过自定义 TCP 协议（基于 `panjf2000/gnet/v2`）维持 SDK 与平台之间的长连接，监听 5003 端口直接对外暴露。该长连接当前**仅承担两件事**：维持设备在线态、心跳保活。原本协议中预留的 `0x05 PUSH` 推送下行帧实际未被使用（`PushService.SendPush` 显式过滤 `is_online=true` 的设备，所有推送均经厂商通道分发）。

平台尚未正式上线，无线上 SDK 用户，可做破坏性变更。基于此，决定一次性将长连通道替换为 WebSocket，原因如下：

- WebSocket 是事实标准，nginx/CDN/各平台 SDK 原生支持，无需自研协议
- WebSocket 有原生 Ping/Pong frame、Close code，可消除当前自定义协议层（`0x01-0xFF` 六种消息类型）
- 走 nginx 反代可统一 TLS 终结、不再单独暴露 5003 端口、与现有 `/api` 路径同站部署
- 可顺手清理一批死代码（集群预留 `gateway_node` 字段、未启用的 PUSH 帧路径等）

## 2. 范围与非目标

### 范围

- 服务端 gateway 进程从 gnet TCP 完全重写为基于 `coder/websocket` 的 WS 服务
- Android、iOS SDK 替换长连接实现（保留所有上层接口）
- nginx 增加 `/ws` 路径反代到 gateway 进程
- 删除当前 TCP 协议定义、集群预留死代码、注册接口里的 gateway 配置返回字段、相关 env 变量

### 非目标

- **不接通"在线设备走长连下行推送"**。长连仍仅承担在线态维持 + 心跳，推送依旧全部经厂商通道（APNs/FCM/HMS/小米/OPPO/VIVO/荣耀/魅族）。
- **不实现多实例集群路由**。当前 gateway_node Redis 注册逻辑只是预留死代码，本次直接删除。如未来需要横向扩容再单独立项。
- **不改 API 服务**（除注册接口去掉 gateway 字段外）。
- **不改厂商通道**任何代码。
- **不引入应用层消息**。WS 通道升级后不交换任何应用层 frame，仅依赖 WS 原生 Ping/Pong + Close。所有上层业务（ACK 回执、角标同步、清除通知、dev-down 等）后续如要走长连可直接增加 JSON 文本帧，不影响本次设计。

## 3. 整体架构

```
                     ┌──────────────┐
SDK (Android/iOS)    │              │
   wss://api.host    │   nginx :443 │  WS upgrade + TLS 终结
   /ws?appid=        │              │  proxy_read_timeout 90s
   &appkey=          │              │
   &token=           └──────┬───────┘
                            │ ws://127.0.0.1:50000/ws (明文)
                            ▼
                     ┌──────────────┐
                     │ gateway 进程  │  独立二进制 (./api gateway)
                     │              │  net/http + coder/websocket
                     │ - 鉴权        │  supervisord 拉起，仅监听内网
                     │ - 在线态写 Redis│  端口 50000 在代码中写死
                     │ - WS Ping/Pong│
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │   Redis      │  device_online:<token>  TTL 2h
                     │   MySQL      │  devices.is_online
                     └──────────────┘
```

**部署形态**：
- gateway 仍为独立进程（沿用现状），由 supervisord 拉起
- gateway 内部监听 `127.0.0.1:50000`（不暴露公网，端口在代码中写死）
- 公网入口仅 443（nginx）；旧 5003 端口停止开放
- TLS 在 nginx 终结，gateway 进程内部不处理 TLS

**进程内通信**：
- 进程内 `sync.Map[token]*websocket.Conn` 维护 token → 连接的映射，仅供"新连挤掉老连"使用
- 不维护跨实例路由表

## 4. WS 握手与鉴权

### 4.1 SDK 端 URL 推导

SDK 已知 API base URL（如 `https://api.doopush.com`），按如下规则推导 WS URL：

- `https://X` → `wss://X/ws`
- `http://X` → `ws://X/ws`

拼上鉴权三参得到完整连接 URL：

```
wss://api.doopush.com/ws?appid=<APP_ID>&appkey=<APP_KEY>&token=<DEVICE_TOKEN>
```

参数说明：

| 参数 | 含义 | 来源 |
|---|---|---|
| `appid` | App 标识 | SDK 初始化时由调用方传入 |
| `appkey` | App 级凭证 | SDK 初始化时由调用方传入 |
| `token` | 设备级 token | `POST /apps/{id}/devices` 注册接口返回 |

### 4.2 服务端鉴权流程

在 `websocket.Accept()` **之前**完成 HTTP 层鉴权：

1. 解析 query 参数：缺任一参数 → HTTP **400 Bad Request**
2. 校验 `(appid, appkey)` 是合法 App 凭证（查 App 表）→ 失败返回 HTTP **401 Unauthorized**
3. 校验 `token` 是合法设备 token，且属于该 `appid`（查 Device 表）→ 失败返回 HTTP **403 Forbidden**
4. 全部通过 → 调 `websocket.Accept()` 升级为 WS（响应 101 Switching Protocols）

返回 4xx 不升级的好处：失败可以走 nginx access log 看到完整 query，便于排查。

### 4.3 升级后的副作用

握手成功立刻执行：

1. 写 Redis：`SET device_online:<token> = <nodeID>`，TTL 2h
2. 更新 MySQL：`devices.is_online = true, last_seen_at = now()`
3. 注册进程内 `sync.Map`：`token → *websocket.Conn`
   - 若已有同 token 旧连接，先用 close code `4001` 关掉旧连接，再注册新连接

**握手即注册**——不再有任何应用层 REGISTER 消息。

## 5. 连接生命周期

### 5.1 服务端心跳

每条连接起两个 goroutine：

```
reader goroutine:
  for {
    typ, data, err := conn.Read(ctx)
    if err != nil { → cleanup & return }
    // 当前阶段忽略所有应用层 frame（保留通道为未来业务预留）
    // Pong frame 由 coder/websocket 自动处理
  }

writer goroutine (心跳):
  ticker := time.NewTicker(30 * time.Second)
  for range ticker.C {
    ctx, cancel := context.WithTimeout(parentCtx, 75 * time.Second)
    if err := conn.Ping(ctx); err != nil {
      conn.Close(StatusPolicyViolation, "pong timeout")
      return
    }
    cancel()
  }
```

`coder/websocket` 的 `conn.Ping()` 同步阻塞等待 Pong，超时返回 error。

### 5.2 SDK 重连策略

沿用当前 TCP 实现的指数退避：

- 初始延迟 1s，每次失败 ×2，封顶 15s
- 无限重试（除收到特定 close code）
- Android：应用切后台 → 主动断开；切前台 → 触发重连
- iOS：受系统网络挂起影响时由 `URLSessionWebSocketDelegate` 状态回调驱动重连

### 5.3 Close code 约定

| Close code | 含义 | SDK 行为 |
|---|---|---|
| `1000` Normal Closure | 正常关闭（双方协商） | 不重连 |
| `1001` Going Away | 一端离开 | 不重连 |
| `1008` Policy Violation | 服务端检测到 pong 超时，主动 Close | 重连（指数退避） |
| `4001` (custom) | 被同 token 新连接挤掉 | **不重连**（用户在另一处登录或装了新版本） |
| `4002` (custom) | 服务端主动停服（优雅下线） | 重连（指数退避） |
| 其他 / 网络中断 / 无 close frame | - | 重连 |

**鉴权失败不在此表**：`appid/appkey/token` 校验失败发生在 HTTP 握手层，返回 4xx 状态码而**不**升级 WS（详见 §4.2），SDK 通过 HTTP 状态码而非 close code 识别。SDK 收到 401/403 应回调 `onError` 让上层重新 register 拿新 token，**不**自动重连。

### 5.4 断开时清理

无论主动断开、被动关闭、还是网络断：

1. 清理进程内 `sync.Map[token]`
2. `DEL device_online:<token>` Redis key
3. 更新 MySQL：`devices.is_online = false`

清理逻辑必须幂等（多次断开事件不会重复扣减）。

## 6. SDK 端改动

### 6.1 Android

**文件**：`sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushTCPConnection.kt` → 重命名为 `DooPushWebSocketConnection.kt`

**改动**：
- 删除 `Socket` / `OutputStream` / 自定义二进制协议编解码
- 用 OkHttp 已有依赖的 WebSocket 实现：
  ```kotlin
  val client = OkHttpClient.Builder()
      .pingInterval(30, TimeUnit.SECONDS)  // OkHttp 自动发 Ping
      .build()
  val request = Request.Builder().url(wsUrl).build()
  client.newWebSocket(request, listener)
  ```
- `WebSocketListener.onClosed(code, reason)` 接 close code 分发逻辑（参照 §5.3 表）
- 复用现有 `ReconnectManager`（指数退避）和应用前后台监听
- 删除接收 `gateway` 配置字段的逻辑，改为从 API base URL 推导 WS URL

### 6.2 iOS

**文件**：`sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushTCPConnection.swift` → 重命名为 `DooPushWebSocketConnection.swift`

**改动**：
- `Package.swift` 把 `.iOS(.v12)` 改为 `.iOS(.v13)`（`URLSessionWebSocketTask` 需要 iOS 13+）
- 用系统原生 `URLSessionWebSocketTask`：
  ```swift
  let task = URLSession.shared.webSocketTask(with: wsURL)
  task.resume()
  // iOS 端 Ping 需要手动周期性调，系统不自动发
  schedulePeriodicPing(every: 30)
  ```
- 用 `URLSessionWebSocketDelegate.urlSession(_:webSocketTask:didCloseWith:reason:)` 接 close code
- 删除自定义 TCP 协议层、二进制编解码代码
- 删除接收 `gateway` 配置字段的逻辑

### 6.3 公共改动

两端 SDK：
- 删除"从 register 接口拿 gateway host/port/ssl"的逻辑
- 改为：API base URL 已知 → 转 scheme（`https`→`wss`, `http`→`ws`）→ 拼 `/ws?...` query

## 7. 服务端实现

### 7.1 文件结构

```
api/internal/gateway/
  server.go      # 整文件重写：net/http server + WS upgrade
  handler.go     # 整文件重写：鉴权 + 升级 + 心跳 + 清理
  conn.go        # 新增：连接状态封装、sync.Map 操作
  // 删除：原 protocol.go (如有)、gnet 相关代码、updateNodeStatus 集群代码
```

### 7.2 入口

`api/cmd/gateway.go` 保留 `gatewayCmd`（cobra 子命令），启动逻辑改为：

```go
mux := http.NewServeMux()
mux.HandleFunc("/ws", gatewayHandler.HandleWebSocket)
mux.HandleFunc("/health", gatewayHandler.HandleHealth)

server := &http.Server{
    Addr:              ":50000",
    Handler:           mux,
    ReadHeaderTimeout: 10 * time.Second,  // 仅约束 HTTP 握手阶段
    // 不设置 WriteTimeout / IdleTimeout：升级为 WS 后连接被 hijack，
    // 长连超时由 §5.1 的应用层 Ping 机制控制
}
log.Fatal(server.ListenAndServe())
```

### 7.3 依赖变更

`api/go.mod`：
- 移除 `github.com/panjf2000/gnet/v2`
- 新增 `github.com/coder/websocket`

## 8. nginx & supervisord

### 8.1 nginx

在现有 `conf/nginx.conf` 的 `/api` location 旁边新增：

```nginx
location /ws {
    proxy_pass http://127.0.0.1:50000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    proxy_read_timeout 90s;     # 必须 > 服务端 75s pong 超时
    proxy_send_timeout 90s;
    proxy_buffering off;        # WS 长连必关
}
```

### 8.2 supervisord

`conf/supervisord.conf` 中 `[program:doopush-gateway]`：
- 启动命令保持 `./api gateway` 不变
- env 段去掉 `GATEWAY_HOST` / `GATEWAY_PORT` / `GATEWAY_SSL`

### 8.3 端口与防火墙

- `127.0.0.1:50000` — gateway 内部监听，仅供 nginx 反代
- `0.0.0.0:443` — nginx 对外
- `0.0.0.0:5003` — **关闭**（旧 TCP 端口，本次完全弃用）

## 9. 删除清单

破坏性变更，无兼容包袱。本次同时清理以下内容：

### 9.1 服务端 Go 代码

- `api/internal/gateway/server.go` — 整文件重写
- `api/internal/gateway/handler.go` — 整文件重写
- `api/internal/gateway/protocol.go`（如有） — 删除自定义协议常量
- `api/internal/gateway/` 中 `updateNodeStatus`、Redis `gateway_node:<nodeID>` 注册代码 — 删除（集群死代码）
- `api/internal/controllers/device_controller.go` — 注册接口返回值里 `gateway` 字段相关代码删除
- `api/internal/models/device.go` — `gateway_node` 字段删除（DB schema 同步删列）
- `go.mod` — 移除 `gnet/v2`，新增 `coder/websocket`

### 9.2 SDK 代码

- Android：`DooPushTCPConnection.kt` → `DooPushWebSocketConnection.kt`，删除自定义二进制协议、Socket 代码
- iOS：`DooPushTCPConnection.swift` → `DooPushWebSocketConnection.swift`，`Package.swift` 提到 iOS 13；删除自定义协议代码
- 两端：删除接收 `gateway` 配置字段的逻辑

### 9.3 配置 / 部署

- `.env` 删除 `GATEWAY_HOST` / `GATEWAY_PORT` / `GATEWAY_SSL`
- `conf/nginx.conf` 新增 `/ws` location
- 防火墙规则去掉 5003

### 9.4 数据库

- `devices.gateway_node` 列删除（写一条 ALTER 迁移）

### 9.5 保留（不动）

- `PushService.SendPush()` 中过滤 `is_online=true` 的逻辑保留（仍然不通过长连下行）
- 厂商通道相关代码完全不动
- `device_online:<token>` Redis key 与 `devices.is_online` 字段保留（现在仍由 gateway 维护）
- API 服务（除注册接口去掉 gateway 字段外）不动

## 10. 测试策略

### 10.1 服务端单元/集成测试

用 Go 写测试客户端 + testcontainers 起 Redis + MySQL，覆盖：

- 鉴权失败（缺参/错 appkey/错 token）→ HTTP 400/401/403，不升级
- 鉴权成功 → 升级 + Redis `device_online:<token>` 写入 + MySQL `is_online=true`
- 主动 Close → Redis key 清理 + MySQL `is_online=false`
- 模拟网络中断（kill -9 client）→ 同上
- 同 token 二次连接 → 旧连接收到 close 4001 + 新连接成功
- 心跳：mock client 30s 不响应 Ping → 服务端在 75s 内 Close
- close code 1008 / 4001 / 4002 在不同场景下的下发正确性

### 10.2 SDK 手动测试

用 demo app 在 Android、iOS 各跑一遍：

- 连上 → 后台 30 分钟 → 前台 → 仍在线
- 拔网 / 切 wifi / 切 4G → 重连
- 改错 token 重启 → 收到 1008 不重连
- 装两台设备同 token → 后连的把先连的踢掉

### 10.3 预生产

- 单实例先跑一周观察连接数曲线、心跳稳定性、内存占用
- 用 Go 写并发模拟客户端，先验证 10k 连接稳定，再阶梯压到 10万（沿用现 gateway 的容量目标）

## 11. 上线步骤

由于平台尚未上线、无线上 SDK 用户：

1. 服务端重写 + nginx 配置上线
2. SDK 同步发版（Android Maven + iOS SPM）
3. 旧 TCP 端口（5003）防火墙关闭
4. 数据库执行 ALTER 删除 `devices.gateway_node` 列

## 12. 风险与权衡

| 风险 | 缓解 |
|---|---|
| 单实例性能瓶颈（10k+ 连接） | 单进程目标 10万连接，预生产压测验证；超过单机容量再做集群 |
| iOS Ping 需手动周期调度 | SDK 内封装定时器，与 Android 行为对齐 |
| nginx `proxy_read_timeout` 设置过短导致空闲连接被切 | 设 90s（> 75s pong 超时），并确保心跳 30s 周期不断 |
| 同 token 多端互踢导致用户体验差 | 由产品决定：当前规则是后连胜出（与 TCP 时代一致），如需保留多连改为 `device_id` 维度而非 `token` 维度 |
| iOS 12 用户被切断 | 平台未上线，2026 年 iOS 12 占比可忽略；`Package.swift` 直接提到 iOS 13 |

## 13. 后续工作（非本次范围）

- 如需"在线设备走长连下行推送"，再单独立项；本次设计中 WS 通道已为未来 JSON 应用层 frame 预留通道
- 多实例集群路由（按 token 哈希到 gateway 节点 + 跨节点消息转发）
- 应用层业务（ACK 回执、角标同步、清除通知、dev-down 等）通过新增 JSON 文本 frame 增加，不影响本次协议
