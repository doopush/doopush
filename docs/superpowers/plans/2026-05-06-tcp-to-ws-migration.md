# TCP → WebSocket 迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 SDK ↔ 平台之间的长连接从自定义 TCP 协议（gnet）整体替换为 WebSocket（coder/websocket）；删除 TCP 协议层、集群预留死代码、注册接口里的 gateway 字段。

**Architecture:** gateway 仍是独立进程（`./api gateway`），监听 `127.0.0.1:50000` 明文 WS；公网入口由 nginx `/ws` 反代到此端口。SDK 用 OkHttp WebSocket（Android）/ URLSessionWebSocketTask（iOS 13+），握手时带 `?appid=&appkey=&token=` 三参鉴权，握手成功即在线，无应用层消息；心跳走 WS 原生 Ping/Pong，断开时清理 Redis + MySQL 在线态。

**Tech Stack:** Go 1.24 / `net/http` / `coder/websocket` / GORM / Redis / OkHttp 4.12 / URLSession / nginx / supervisord

**Spec:** `docs/superpowers/specs/2026-05-06-tcp-to-ws-migration-design.md`

---

## 文件结构

### 服务端新增 / 重写

| 文件 | 责任 |
|---|---|
| `api/internal/gateway/server.go` | **重写**：`net/http.Server` 启动 + 优雅关闭 + 启动时清零在线态 |
| `api/internal/gateway/handler.go` | **重写**：HTTP 路由（`/ws`、`/health`） |
| `api/internal/gateway/auth.go` | **新增**：query 参数解析 + appid/appkey/token 校验 |
| `api/internal/gateway/registry.go` | **新增**：`token → *websocket.Conn` 进程内注册表（含"挤掉老连"语义） |
| `api/internal/gateway/online.go` | **新增**：在线态副作用（Redis + MySQL） |
| `api/internal/gateway/websocket.go` | **新增**：单条 WS 连接的生命周期循环（reader / Ping） |

### 服务端修改

| 文件 | 改动 |
|---|---|
| `api/cmd/gateway.go` | 入口保留，端口判断逻辑去掉 `GetPort()` 改用常量 |
| `api/internal/controllers/device_controller.go` | 注册接口返回值删除 `gateway` 字段、`getGatewayConfig` 方法 |
| `api/internal/models/device.go` | 删除 `GatewayNode` / `ConnectionID` 字段 |
| `api/internal/services/device_service.go` | `SetAllDevicesOffline` 不再清空两个被删字段 |
| `api/go.mod` / `api/go.sum` | 移除 `panjf2000/gnet/v2`，新增 `coder/websocket` |
| `api/internal/database/database.go` | 启动时执行一次幂等 ALTER 删除两列 |

### SDK 改动

| 文件 | 改动 |
|---|---|
| `sdk/android/.../DooPushTCPConnection.kt` → `DooPushWebSocketConnection.kt` | 重命名 + 全文重写（OkHttp WebSocket） |
| `sdk/android/.../DooPushManager.kt` | 修改 TCPConnection 引用 |
| `sdk/ios/.../DooPushTCPConnection.swift` → `DooPushWebSocketConnection.swift` | 重命名 + 全文重写（URLSessionWebSocketTask） |
| `sdk/ios/.../DooPushManager.swift` | 修改 TCPConnection 引用 |
| `sdk/ios/DooPushSDK/Package.swift` | `.iOS(.v12)` → `.iOS(.v13)` |

### 配置

| 文件 | 改动 |
|---|---|
| `conf/nginx.conf` | 新增 `location /ws` |
| `.env` / `.env.example` | 删除 `GATEWAY_HOST` / `GATEWAY_PORT` / `GATEWAY_SSL` |
| `conf/supervisord.conf` | 不变（gateway 进程入口和环境无需调整） |

---

## Task 1：依赖与骨架

**目标**：移除 gnet，引入 `coder/websocket`，删除旧 gateway 包内文件，准备空骨架。

**Files:**
- Modify: `api/go.mod`
- Delete: `api/internal/gateway/server.go`
- Delete: `api/internal/gateway/handler.go`
- Modify: `api/cmd/gateway.go`

- [ ] **Step 1：调整 go.mod 依赖**

```bash
cd api
go get github.com/coder/websocket@latest
go mod edit -droprequire=github.com/panjf2000/gnet/v2
go mod tidy
```

- [ ] **Step 2：删除旧 gateway 实现**

```bash
rm api/internal/gateway/server.go
rm api/internal/gateway/handler.go
```

- [ ] **Step 3：建空文件骨架**

创建 `api/internal/gateway/server.go`：

```go
package gateway

import "log"

type GatewayServer struct{}

func NewGatewayServer() (*GatewayServer, error) {
	return &GatewayServer{}, nil
}

func (s *GatewayServer) Start() error {
	log.Fatal("gateway not yet implemented")
	return nil
}

// GetPort 兼容 cmd/gateway.go 的旧签名，本次重构后会移除
func (s *GatewayServer) GetPort() int {
	return 50000
}
```

- [ ] **Step 4：编译通过**

```bash
cd api
go build ./...
```

预期：编译成功，无报错。

- [ ] **Step 5：commit**

```bash
git add api/go.mod api/go.sum api/internal/gateway/
git commit -m "refactor(gateway): 移除 gnet，引入 coder/websocket，准备 WS 重写骨架"
```

---

## Task 2：握手鉴权（auth.go，TDD）

**目标**：实现 `?appid=&appkey=&token=` 三参解析与校验。

**Files:**
- Create: `api/internal/gateway/auth.go`
- Test: `api/internal/gateway/auth_test.go`

- [ ] **Step 1：写失败测试**

创建 `api/internal/gateway/auth_test.go`：

```go
package gateway

import (
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestParseHandshakeParams_OK(t *testing.T) {
	r := httptest.NewRequest("GET", "/ws?appid=42&appkey=secret&token=abc", nil)
	p, err := parseHandshakeParams(r)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.AppID != 42 || p.AppKey != "secret" || p.Token != "abc" {
		t.Fatalf("got %+v", p)
	}
}

func TestParseHandshakeParams_Missing(t *testing.T) {
	cases := []url.Values{
		{"appkey": {"x"}, "token": {"y"}},
		{"appid": {"1"}, "token": {"y"}},
		{"appid": {"1"}, "appkey": {"x"}},
		{"appid": {"abc"}, "appkey": {"x"}, "token": {"y"}}, // 非数字 appid
	}
	for i, q := range cases {
		r := httptest.NewRequest("GET", "/ws?"+q.Encode(), nil)
		if _, err := parseHandshakeParams(r); err == nil {
			t.Fatalf("case %d expected error, got nil", i)
		}
	}
}
```

- [ ] **Step 2：跑测试，确认失败**

```bash
cd api
go test ./internal/gateway/... -run TestParseHandshakeParams -v
```

预期：FAIL（`parseHandshakeParams` 未定义）。

- [ ] **Step 3：实现 auth.go**

创建 `api/internal/gateway/auth.go`：

```go
package gateway

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
	"gorm.io/gorm"
)

// HandshakeParams 握手 query 三参
type HandshakeParams struct {
	AppID  uint
	AppKey string
	Token  string
}

var (
	errMissingParam = errors.New("missing required query param")
	errBadAppKey    = errors.New("invalid appkey")
	errBadToken     = errors.New("invalid device token")
)

// parseHandshakeParams 从请求 query 中解析三参
func parseHandshakeParams(r *http.Request) (*HandshakeParams, error) {
	q := r.URL.Query()
	appIDStr := q.Get("appid")
	appKey := q.Get("appkey")
	token := q.Get("token")
	if appIDStr == "" || appKey == "" || token == "" {
		return nil, errMissingParam
	}
	id, err := strconv.ParseUint(appIDStr, 10, 32)
	if err != nil {
		return nil, fmt.Errorf("invalid appid: %w", err)
	}
	return &HandshakeParams{AppID: uint(id), AppKey: appKey, Token: token}, nil
}

// authenticate 校验三参；返回设备 ID（成功）或 error（失败，error 携带 HTTP status hint）
type authError struct {
	status int
	msg    string
}

func (e *authError) Error() string { return e.msg }

func authenticate(db *gorm.DB, p *HandshakeParams) (deviceID uint, err error) {
	// 1. App 存在且启用
	var app models.App
	if err := db.Where("id = ? AND status = 1", p.AppID).First(&app).Error; err != nil {
		return 0, &authError{status: http.StatusUnauthorized, msg: "app not found"}
	}
	// 2. AppKey 哈希匹配
	keyHash := utils.HashString(p.AppKey)
	var apiKey models.AppAPIKey
	if err := db.Where("app_id = ? AND key_hash = ?", p.AppID, keyHash).First(&apiKey).Error; err != nil {
		return 0, &authError{status: http.StatusUnauthorized, msg: "invalid appkey"}
	}
	// 3. 设备 token 哈希匹配
	tokenHash := utils.HashString(p.Token)
	var device models.Device
	if err := db.Where("app_id = ? AND token_hash = ? AND status = 1", p.AppID, tokenHash).First(&device).Error; err != nil {
		return 0, &authError{status: http.StatusForbidden, msg: "invalid token"}
	}
	return device.ID, nil
}

// AuthenticateRequest HTTP 层入口，握手前调用
func AuthenticateRequest(r *http.Request) (*HandshakeParams, uint, *authError) {
	p, err := parseHandshakeParams(r)
	if err != nil {
		return nil, 0, &authError{status: http.StatusBadRequest, msg: err.Error()}
	}
	deviceID, err := authenticate(database.DB, p)
	if err != nil {
		if ae, ok := err.(*authError); ok {
			return nil, 0, ae
		}
		return nil, 0, &authError{status: http.StatusInternalServerError, msg: err.Error()}
	}
	return p, deviceID, nil
}
```

- [ ] **Step 4：跑测试，确认通过**

```bash
cd api
go test ./internal/gateway/... -run TestParseHandshakeParams -v
```

预期：PASS（两个子测试全部通过）。

- [ ] **Step 5：commit**

```bash
git add api/internal/gateway/auth.go api/internal/gateway/auth_test.go
git commit -m "feat(gateway): 实现握手鉴权 (appid/appkey/token)"
```

---

## Task 3：连接注册表（registry.go，TDD）

**目标**：维护 `token → *websocket.Conn` 映射，新连挤掉老连（关 close code 4001）。

**Files:**
- Create: `api/internal/gateway/registry.go`
- Test: `api/internal/gateway/registry_test.go`

- [ ] **Step 1：写失败测试**

创建 `api/internal/gateway/registry_test.go`：

```go
package gateway

import (
	"sync"
	"testing"
)

// fakeConn 满足 Closer 接口，记录 Close 调用
type fakeConn struct {
	mu       sync.Mutex
	closed   bool
	code     int
	reason   string
}

func (f *fakeConn) CloseWith(code int, reason string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.closed = true
	f.code = code
	f.reason = reason
}

func TestRegistry_Register_NewToken(t *testing.T) {
	reg := newRegistry()
	c := &fakeConn{}
	reg.register("tok1", c)
	if got := reg.get("tok1"); got != c {
		t.Fatalf("expected stored conn")
	}
}

func TestRegistry_Register_KicksOld(t *testing.T) {
	reg := newRegistry()
	old := &fakeConn{}
	reg.register("tok1", old)
	newC := &fakeConn{}
	reg.register("tok1", newC)

	if !old.closed || old.code != 4001 {
		t.Fatalf("old conn should be closed with 4001, got closed=%v code=%d", old.closed, old.code)
	}
	if reg.get("tok1") != newC {
		t.Fatalf("registry should now hold new conn")
	}
}

func TestRegistry_Unregister_OnlyIfMatches(t *testing.T) {
	reg := newRegistry()
	c1 := &fakeConn{}
	reg.register("tok1", c1)
	// 不同实例 unregister 返回 false 且 registry 不变
	c2 := &fakeConn{}
	if reg.unregister("tok1", c2) {
		t.Fatalf("unregister with non-matching conn should return false")
	}
	if reg.get("tok1") != c1 {
		t.Fatalf("registry should still hold c1")
	}
	// 同实例可以 unregister，返回 true
	if !reg.unregister("tok1", c1) {
		t.Fatalf("unregister with matching conn should return true")
	}
	if reg.get("tok1") != nil {
		t.Fatalf("registry should be empty after matching unregister")
	}
}
```

- [ ] **Step 2：跑测试，确认失败**

```bash
cd api
go test ./internal/gateway/... -run TestRegistry -v
```

预期：FAIL（`newRegistry` 等未定义）。

- [ ] **Step 3：实现 registry.go**

创建 `api/internal/gateway/registry.go`：

```go
package gateway

import "sync"

// closer 抽象任何能被以 close code + reason 关闭的连接
type closer interface {
	CloseWith(code int, reason string)
}

// registry 维护 token → 连接的进程内单例映射
type registry struct {
	mu sync.Mutex
	m  map[string]closer
}

func newRegistry() *registry {
	return &registry{m: make(map[string]closer)}
}

// register 注册新连接；若同 token 已有旧连接，先用 4001 关掉
func (r *registry) register(token string, c closer) {
	r.mu.Lock()
	old, ok := r.m[token]
	r.m[token] = c
	r.mu.Unlock()
	if ok && old != nil {
		// 异步关闭，避免持锁
		go old.CloseWith(4001, "replaced by new connection")
	}
}

// unregister 仅当当前注册项就是 c 时才删除；返回 true 表示真删了
// （被挤掉的老连解锁清理时会走到这里，但 registry 已被替换为新连，
//   返回 false 让上层跳过 MarkOffline，避免清掉新连的在线态）
func (r *registry) unregister(token string, c closer) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if cur, ok := r.m[token]; ok && cur == c {
		delete(r.m, token)
		return true
	}
	return false
}

// get 主要给测试用
func (r *registry) get(token string) closer {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.m[token]
}
```

- [ ] **Step 4：跑测试，确认通过**

```bash
cd api
go test ./internal/gateway/... -run TestRegistry -v
```

预期：三个子测试全 PASS。注意 `TestRegistry_Register_KicksOld` 因 `register` 异步关闭老连，需要给 goroutine 一点时间——若不稳定，在测试里加 `time.Sleep(10*time.Millisecond)` 后再断言。

- [ ] **Step 5：commit**

```bash
git add api/internal/gateway/registry.go api/internal/gateway/registry_test.go
git commit -m "feat(gateway): 连接注册表，新连挤掉老连 (close 4001)"
```

---

## Task 4：在线态副作用（online.go）

**目标**：把 Redis 写 / 删 + MySQL `is_online` 切换抽成纯函数，便于测试与复用。

**Files:**
- Create: `api/internal/gateway/online.go`

- [ ] **Step 1：实现 online.go**

创建 `api/internal/gateway/online.go`：

```go
package gateway

import (
	"context"
	"fmt"
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
		now := time.Now()
		tokenHash := utils.HashString(token)
		err := database.DB.Model(&models.Device{}).
			Where("app_id = ? AND token_hash = ?", appID, tokenHash).
			Update("is_online", false).Error
		_ = now
		if err != nil {
			log.Printf("db mark offline failed token=%s: %v", token, err)
		}
	}()
}

// RefreshOnlineTTL 收到 pong 时刷一下 TTL，避免 Redis key 在长连仍存活时过期
func RefreshOnlineTTL(rdb *redis.Client, token string) {
	ctx := context.Background()
	if err := rdb.Expire(ctx, onlineKeyPrefix+token, onlineTTL).Err(); err != nil {
		log.Printf("redis refresh ttl failed: %v", err)
	}
}

// errMsg 给 nginx 日志便于排查的辅助
func authErrMsg(status int) string {
	return fmt.Sprintf("auth failed (%d)", status)
}
```

- [ ] **Step 2：编译验证**

```bash
cd api
go build ./...
```

预期：编译通过。

- [ ] **Step 3：commit**

```bash
git add api/internal/gateway/online.go
git commit -m "feat(gateway): 在线态副作用 helper (Redis + MySQL)"
```

---

## Task 5：单连接生命周期（websocket.go）

**目标**：封装一条 WS 连接的 reader 循环 + 30s/75s Ping 心跳；实现 `closer` 接口供 registry 用。

**Files:**
- Create: `api/internal/gateway/websocket.go`

- [ ] **Step 1：实现 websocket.go**

创建 `api/internal/gateway/websocket.go`：

```go
package gateway

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/coder/websocket"
)

const (
	pingInterval = 30 * time.Second
	pongTimeout  = 75 * time.Second
)

// wsConn 包装一条 WS 连接，实现 closer 接口
type wsConn struct {
	c       *websocket.Conn
	token   string
	appID   uint
	once    sync.Once
	closeFn func() // 注册到 registry / 在线态清理
}

// CloseWith 满足 closer 接口
func (w *wsConn) CloseWith(code int, reason string) {
	w.once.Do(func() {
		_ = w.c.Close(websocket.StatusCode(code), reason)
		if w.closeFn != nil {
			w.closeFn()
		}
	})
}

// run 启动 reader + ping，阻塞直到任一返回
func (w *wsConn) run(ctx context.Context) {
	readerErr := make(chan error, 1)
	pingErr := make(chan error, 1)

	// reader：丢弃所有应用层 frame（本期协议无应用层消息）
	go func() {
		for {
			if _, _, err := w.c.Read(ctx); err != nil {
				readerErr <- err
				return
			}
			// 应用层消息丢弃，未来扩展业务时在此分发
		}
	}()

	// ping 循环
	go func() {
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				pingErr <- ctx.Err()
				return
			case <-ticker.C:
				pctx, cancel := context.WithTimeout(ctx, pongTimeout)
				err := w.c.Ping(pctx)
				cancel()
				if err != nil {
					pingErr <- err
					return
				}
			}
		}
	}()

	select {
	case err := <-readerErr:
		log.Printf("ws reader exit token=%s: %v", w.token, err)
	case err := <-pingErr:
		log.Printf("ws ping exit token=%s: %v", w.token, err)
		w.CloseWith(int(websocket.StatusPolicyViolation), "pong timeout")
	}
}
```

- [ ] **Step 2：编译验证**

```bash
cd api
go build ./...
```

预期：编译通过。

- [ ] **Step 3：commit**

```bash
git add api/internal/gateway/websocket.go
git commit -m "feat(gateway): WS 单连接生命周期 (reader + ping/pong)"
```

---

## Task 6：HTTP 路由 + WS upgrade（handler.go）

**目标**：处理 `/ws` 握手、鉴权、升级、注册、生命周期、清理；以及 `/health` 路径。

**Files:**
- Create: `api/internal/gateway/handler.go`

- [ ] **Step 1：实现 handler.go**

创建 `api/internal/gateway/handler.go`：

```go
package gateway

import (
	"context"
	"net/http"

	"github.com/coder/websocket"
	"github.com/redis/go-redis/v9"
)

// Handler 持有 gateway 全局状态
type Handler struct {
	reg *registry
	rdb *redis.Client
}

func NewHandler(rdb *redis.Client) *Handler {
	return &Handler{reg: newRegistry(), rdb: rdb}
}

// HandleHealth 健康检查
func (h *Handler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}

// HandleWebSocket WS 入口
func (h *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// 1. 鉴权（在 Accept 之前）
	params, _, ae := AuthenticateRequest(r)
	if ae != nil {
		http.Error(w, ae.msg, ae.status)
		return
	}

	// 2. 升级
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		// SDK 与 gateway 同源走 nginx，不做跨域校验；
		// nginx 已处理 Origin，这里关闭 server 端校验
		InsecureSkipVerify: true,
	})
	if err != nil {
		// websocket.Accept 失败时已写入响应，无需再 WriteHeader
		return
	}

	// 3. 在线态 + 注册到表，设置清理钩子
	wc := &wsConn{c: c, token: params.Token, appID: params.AppID}
	wc.closeFn = func() {
		// 仅当 registry 中确实是本连接时才清离线态；
		// 否则说明被新连接挤掉了，不能去清新连的在线态
		if h.reg.unregister(params.Token, wc) {
			MarkOffline(h.rdb, params.AppID, params.Token)
		}
	}
	h.reg.register(params.Token, wc) // 内部会异步关掉同 token 老连
	MarkOnline(h.rdb, params.AppID, params.Token)

	// 4. 跑生命周期，阻塞到断开；返回后调 CloseWith 触发清理
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	wc.run(ctx)
	wc.CloseWith(int(websocket.StatusNormalClosure), "")
}
```

- [ ] **Step 2：编译验证**

```bash
cd api
go build ./...
```

预期：编译通过。

- [ ] **Step 3：commit**

```bash
git add api/internal/gateway/handler.go
git commit -m "feat(gateway): HTTP 路由 + WS upgrade 入口"
```

---

## Task 7：服务端 bootstrap（重写 server.go）

**目标**：起 `http.Server` 监听 `:50000`，启动时清零所有设备在线态，处理优雅关闭。

**Files:**
- Modify: `api/internal/gateway/server.go`
- Modify: `api/cmd/gateway.go`

- [ ] **Step 1：重写 server.go**

完全替换 `api/internal/gateway/server.go` 的内容：

```go
package gateway

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/doopush/doopush/api/internal/config"
	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/services"
	"github.com/redis/go-redis/v9"
)

const ListenAddr = ":50000"

// GatewayServer WebSocket 网关
type GatewayServer struct {
	rdb     *redis.Client
	handler *Handler
	srv     *http.Server
}

// NewGatewayServer 构造（连 DB / Redis）
func NewGatewayServer() (*GatewayServer, error) {
	database.Connect()

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

	h := NewHandler(rdb)
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", h.HandleWebSocket)
	mux.HandleFunc("/health", h.HandleHealth)

	srv := &http.Server{
		Addr:              ListenAddr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	return &GatewayServer{rdb: rdb, handler: h, srv: srv}, nil
}

// Start 监听并阻塞
func (s *GatewayServer) Start() error {
	// 异步清零历史在线态（大表 UPDATE 可能很慢，不能阻塞监听）
	go func() {
		if err := services.NewDeviceService().SetAllDevicesOffline(); err != nil {
			log.Printf("清零在线态失败: %v", err)
		}
	}()

	// 信号驱动优雅关闭
	go s.handleSignals()

	log.Printf("WebSocket gateway 监听 %s", ListenAddr)
	if err := s.srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("gateway 启动失败: %w", err)
	}
	return nil
}

func (s *GatewayServer) handleSignals() {
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGTERM, syscall.SIGINT)
	<-ch
	log.Println("收到关闭信号，开始优雅关闭")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = s.srv.Shutdown(ctx)
	_ = s.rdb.Close()
}

// 兼容 cmd/gateway.go 中开发期 KillProcessByPort 的调用签名
func (s *GatewayServer) GetPort() int { return 50000 }
```

- [ ] **Step 2：cmd/gateway.go 几乎不改**

打开 `api/cmd/gateway.go`：现有代码已经能用（调 `NewGatewayServer().Start()`，并在开发模式下用 `GetPort()` 杀端口）。无需修改。

- [ ] **Step 3：编译并启动验证**

```bash
cd api
go build -o /tmp/doopush-api .
/tmp/doopush-api gateway -e ../.env &
GATEWAY_PID=$!
sleep 2
curl -sf http://127.0.0.1:50000/health
kill $GATEWAY_PID
```

预期：`curl` 返回 `OK`。

- [ ] **Step 4：commit**

```bash
git add api/internal/gateway/server.go api/cmd/gateway.go
git commit -m "feat(gateway): http.Server bootstrap，监听 :50000，优雅关闭"
```

---

## Task 8：手动联调握手鉴权

**目标**：用 `wscat` 或 Go 测试客户端验证 `/ws` 鉴权 + 升级 + 在线态写 Redis。

**Files:** none

- [ ] **Step 1：启动 gateway**

```bash
cd api
go build -o /tmp/doopush-api .
/tmp/doopush-api gateway -e ../.env &
GATEWAY_PID=$!
```

- [ ] **Step 2：缺参 → 400**

```bash
curl -i "http://127.0.0.1:50000/ws"
```

预期：`HTTP/1.1 400 Bad Request`，body 含 `missing required query param`。

- [ ] **Step 3：错 appkey → 401**

需要先确认本地 DB 有一个 App + 一个 AppAPIKey + 一个 Device。可以用 `mysql` 直接查：

```bash
mysql -u<USER> -p<PASS> doopush -e \
  "SELECT a.id app_id, ak.key_hash, d.token, d.token_hash FROM apps a LEFT JOIN app_api_keys ak ON a.id=ak.app_id LEFT JOIN devices d ON a.id=d.app_id LIMIT 1;"
```

记下 `app_id` 和**已知**对应明文 appkey、token（这些在创建 App / Device 时由调用方自管）。

```bash
# 用错 appkey
wscat -c "ws://127.0.0.1:50000/ws?appid=<APP_ID>&appkey=wrong&token=<TOKEN>"
```

预期：连接失败（HTTP 401）。如无 `wscat`：

```bash
curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "http://127.0.0.1:50000/ws?appid=<APP_ID>&appkey=wrong&token=<TOKEN>"
```

预期 `HTTP/1.1 401`。

- [ ] **Step 4：成功握手**

```bash
wscat -c "ws://127.0.0.1:50000/ws?appid=<APP_ID>&appkey=<APP_KEY>&token=<TOKEN>"
```

预期：成功连接，命令行进入交互模式。

- [ ] **Step 5：验证 Redis 在线态**

```bash
redis-cli GET device_online:<TOKEN>
```

预期：返回 `"1"`。

- [ ] **Step 6：验证 MySQL is_online**

```bash
mysql -u<USER> -p<PASS> doopush -e \
  "SELECT id, token, is_online FROM devices WHERE token='<TOKEN>';"
```

预期：`is_online = 1`。

- [ ] **Step 7：断开 wscat（Ctrl+C），验证清理**

```bash
sleep 2
redis-cli GET device_online:<TOKEN>
mysql -u<USER> -p<PASS> doopush -e \
  "SELECT is_online FROM devices WHERE token='<TOKEN>';"
```

预期：Redis key 不存在（`(nil)`）；MySQL `is_online = 0`。

- [ ] **Step 8：关闭 gateway**

```bash
kill $GATEWAY_PID
```

无需 commit（仅手动验证）。

---

## Task 9：删除注册接口里的 gateway 字段

**目标**：API 服务的 `POST /apps/:id/devices` 不再返回 gateway 配置；SDK 自己用 API base URL 推导 WS URL。

**Files:**
- Modify: `api/internal/controllers/device_controller.go`

- [ ] **Step 1：删除 GatewayConfig 与 DeviceRegistrationResponse 结构体**

打开 `api/internal/controllers/device_controller.go`，删除 L50-61 的两个结构体（整段）：

```go
// 整段删除：
// GatewayConfig Gateway配置信息
type GatewayConfig struct {
    Host string `json:"host" example:"gateway.doopush.com"`
    Port int    `json:"port" example:"5003"`
    SSL  bool   `json:"ssl" example:"false"`
}

// DeviceRegistrationResponse 设备注册响应（包含Gateway配置）
type DeviceRegistrationResponse struct {
    Device  interface{}   `json:"device"`
    Gateway GatewayConfig `json:"gateway"`
}
```

- [ ] **Step 2：简化 RegisterDevice 响应**

修改 L116-129，移除 gateway 包装、直接返回 device：

```go
// before (L116-129):
// 构建 Gateway 配置
gatewayConfig := d.getGatewayConfig(c)

// 构建包含 Gateway 配置的响应
registrationResponse := DeviceRegistrationResponse{
    Device:  device,
    Gateway: gatewayConfig,
}

c.JSON(http.StatusCreated, response.APIResponse{
    Code:    201,
    Message: "设备注册成功",
    Data:    registrationResponse,
})

// after:
c.JSON(http.StatusCreated, response.APIResponse{
    Code:    201,
    Message: "设备注册成功",
    Data:    device,
})
```

- [ ] **Step 3：删除 getGatewayConfig 方法**

定位 ~L352-371 的整段 `func (d *DeviceController) getGatewayConfig(c *gin.Context) GatewayConfig { ... }`，整段删除。

- [ ] **Step 4：更新 Swagger 注解**

修改 RegisterDevice 函数上方的 swagger 注释：

```go
// before:
// @Description 注册设备以接收推送通知。... 成功注册后返回设备信息和Gateway长连接配置
// @Success 201 {object} response.APIResponse{data=DeviceRegistrationResponse} "注册成功，包含设备信息和Gateway配置"

// after:
// @Description 注册设备以接收推送通知。需要验证API Key属于指定应用且bundle_id与应用包名匹配。可以在注册时同时设置设备标签
// @Success 201 {object} response.APIResponse "注册成功，返回设备信息"
```

- [ ] **Step 5：grep 确认无引用**

```bash
cd api
grep -rn "getGatewayConfig\|DeviceRegistrationResponse\|GatewayConfig\b" --include="*.go" .
```

预期：无输出（gateway 包内已无 GatewayConfig；该名字旧 server.go 中 `GatewayConfig` 结构体在 Task 1 已随文件删除）。

- [ ] **Step 6：编译**

```bash
go build ./...
```

预期：通过。

- [ ] **Step 7：commit**

```bash
git add api/internal/controllers/device_controller.go
git commit -m "refactor(device): 注册接口不再返回 gateway 配置 (SDK 自推导)"
```

---

## Task 10：删除 device.gateway_node / connection_id 字段

**目标**：从 `Device` 模型移除 TCP 时代的两个死字段，并通过启动时一次性 ALTER 落到 DB 上。

**Files:**
- Modify: `api/internal/models/device.go`
- Modify: `api/internal/services/device_service.go`
- Modify: `api/internal/database/database.go`

- [ ] **Step 1：从模型删字段**

打开 `api/internal/models/device.go`，删除字段：

```go
// 删除这两行（约 L26-L27）：
GatewayNode  string `json:"gateway_node" gorm:"size:64"`
ConnectionID string `json:"connection_id" gorm:"size:128"`
```

- [ ] **Step 2：更新 SetAllDevicesOffline**

打开 `api/internal/services/device_service.go`（约 L221-L233），修改 `SetAllDevicesOffline` 方法移除两字段清空逻辑：

```go
// before:
return database.DB.Model(&models.Device{}).
    Where("is_online = ?", true).
    Updates(map[string]interface{}{
        "is_online":     false,
        "gateway_node":  "",
        "connection_id": "",
    }).Error

// after:
return database.DB.Model(&models.Device{}).
    Where("is_online = ?", true).
    Update("is_online", false).Error
```

- [ ] **Step 3：在 database.go AutoMigrate 后追加 ALTER**

打开 `api/internal/database/database.go`，在 `AutoMigrate` 调用后追加：

```go
// 一次性清理 TCP 时代的死字段（GORM AutoMigrate 不会删列）
_ = DB.Migrator().DropColumn(&models.Device{}, "gateway_node")
_ = DB.Migrator().DropColumn(&models.Device{}, "connection_id")
```

GORM Migrator 的 DropColumn 在列不存在时静默成功，所以幂等。

- [ ] **Step 4：grep 确认无引用**

```bash
cd api
grep -rn "GatewayNode\|ConnectionID\|gateway_node\|connection_id" --include="*.go" .
```

预期：除了刚加的 ALTER 调用，其他无引用。如有遗漏处理掉。

- [ ] **Step 5：编译并跑一次启动**

```bash
go build -o /tmp/doopush-api .
/tmp/doopush-api gateway -e ../.env &
GATEWAY_PID=$!
sleep 3
kill $GATEWAY_PID
```

- [ ] **Step 6：验证 DB 列已删**

```bash
mysql -u<USER> -p<PASS> doopush -e "DESCRIBE devices;" | grep -E "gateway_node|connection_id"
```

预期：grep 无输出（列已删）。

- [ ] **Step 7：commit**

```bash
git add api/internal/models/device.go api/internal/services/device_service.go api/internal/database/database.go
git commit -m "refactor(device): 删除 gateway_node/connection_id 死字段（含 DB 列）"
```

---

## Task 11：Android SDK — 替换为 WebSocket

**目标**：删除自定义 TCP 协议层，改用 OkHttp WebSocket。

**Files:**
- Rename + rewrite: `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushTCPConnection.kt` → `DooPushWebSocketConnection.kt`
- Modify: `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt`

- [ ] **Step 1：git mv 并清空旧文件内容**

```bash
cd sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk
git mv DooPushTCPConnection.kt DooPushWebSocketConnection.kt
```

- [ ] **Step 2：重写文件内容**

完全替换 `DooPushWebSocketConnection.kt`：

```kotlin
package com.doopush.sdk

import android.util.Log
import okhttp3.*
import okio.ByteString
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 维护设备到平台的 WebSocket 长连接。
 *
 * 仅承担：
 *   1. 建连后向平台标记设备在线（握手 query 鉴权）
 *   2. 30s 周期 Ping 维持心跳
 *   3. 断线指数退避重连
 *
 * 不再承载任何应用层消息。
 */
class DooPushWebSocketConnection(
    private val baseUrl: String,
    private val appId: String,
    private val appKey: String,
    private val token: String,
    private val listener: Listener,
) {
    interface Listener {
        fun onOpen()
        fun onClosed(code: Int, reason: String)
        fun onFailure(t: Throwable)
    }

    private val client: OkHttpClient = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)  // OkHttp 自动发 Ping
        .build()

    @Volatile
    private var ws: WebSocket? = null
    private val active = AtomicBoolean(false)
    private var reconnectDelayMs = 1_000L
    private val maxReconnectMs = 15_000L
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    fun connect() {
        if (active.getAndSet(true)) return
        doConnect()
    }

    fun disconnect() {
        active.set(false)
        ws?.close(1000, "client disconnect")
        ws = null
    }

    private fun doConnect() {
        val wsUrl = wsUrlFromBase(baseUrl)
        val req = Request.Builder()
            .url("$wsUrl?appid=$appId&appkey=$appKey&token=$token")
            .build()
        ws = client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "ws open")
                reconnectDelayMs = 1_000L
                listener.onOpen()
            }

            override fun onMessage(webSocket: WebSocket, text: String) { /* 应用层消息预留，本期忽略 */ }
            override fun onMessage(webSocket: WebSocket, bytes: ByteString) { /* 同上 */ }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(code, reason)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "ws closed code=$code reason=$reason")
                listener.onClosed(code, reason)
                if (shouldReconnect(code)) scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w(TAG, "ws failure: ${t.message}, http=${response?.code}")
                listener.onFailure(t)
                if (shouldReconnectOnFailure(response)) scheduleReconnect()
            }
        })
    }

    private fun shouldReconnect(code: Int): Boolean {
        if (!active.get()) return false
        // 不重连：1000/1001 正常关闭、4001 被新连挤掉
        // 重连：1008 (pong 超时，多半网络抖动)、其他异常
        return code != 4001 && code != 1000 && code != 1001
    }

    private fun shouldReconnectOnFailure(response: Response?): Boolean {
        if (!active.get()) return false
        // 鉴权失败 (HTTP 4xx) 不重连，由上层重新 register 拿新 token
        val httpCode = response?.code ?: 0
        if (httpCode in 400..499) return false
        return true
    }

    private fun scheduleReconnect() {
        val delay = reconnectDelayMs
        reconnectDelayMs = (reconnectDelayMs * 2).coerceAtMost(maxReconnectMs)
        handler.postDelayed({ if (active.get()) doConnect() }, delay)
    }

    companion object {
        private const val TAG = "DooPushWS"
        internal fun wsUrlFromBase(baseUrl: String): String =
            baseUrl
                .replaceFirst(Regex("^https://"), "wss://")
                .replaceFirst(Regex("^http://"), "ws://")
                .trimEnd('/') + "/ws"
    }
}
```

- [ ] **Step 3：修改 DooPushManager.kt**

打开 `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt`，找原本初始化 `DooPushTCPConnection` 的位置（约 L61），替换为 `DooPushWebSocketConnection`，构造参数对应 baseUrl / appId / appKey / token。

具体改法（按现有代码结构调整）：把所有 `DooPushTCPConnection` 类引用改为 `DooPushWebSocketConnection`；原本通过 `gateway` 配置字段接收 host/port 的逻辑改为直接使用 API baseUrl。删除接收 `gateway` 字段的反序列化代码。

- [ ] **Step 4：grep 确认无残余 TCP 引用**

```bash
cd sdk/android
grep -rn "DooPushTCPConnection\|gateway_host\|gateway_port\|gateway_ssl" --include="*.kt" .
```

预期：无输出。

- [ ] **Step 5：编译 SDK**

```bash
cd sdk/android/DooPushSDK
./gradlew :lib:assembleDebug
```

预期：BUILD SUCCESSFUL。

- [ ] **Step 6：commit**

```bash
git add sdk/android/
git commit -m "feat(sdk-android): 替换 TCP 长连为 WebSocket (OkHttp)"
```

---

## Task 12：iOS SDK — 替换为 WebSocket（含 iOS 13+ 升级）

**目标**：删除自定义 TCP 实现，改用 `URLSessionWebSocketTask`；最低系统版本提到 iOS 13。

**Files:**
- Modify: `sdk/ios/DooPushSDK/Package.swift`
- Rename + rewrite: `sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushTCPConnection.swift` → `DooPushWebSocketConnection.swift`
- Modify: `sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushManager.swift`

- [ ] **Step 1：升级 deployment target**

修改 `sdk/ios/DooPushSDK/Package.swift`：

```swift
platforms: [
    .iOS(.v13)  // 原为 .iOS(.v12)
],
```

如有 `.podspec`，同步更新 `s.platform = :ios, '13.0'`。

- [ ] **Step 2：git mv 并重写**

```bash
cd sdk/ios/DooPushSDK/Sources/DooPushSDK
git mv DooPushTCPConnection.swift DooPushWebSocketConnection.swift
```

- [ ] **Step 3：写新文件内容**

完全替换 `DooPushWebSocketConnection.swift`：

```swift
import Foundation

/// 维护设备到平台的 WebSocket 长连接。
/// 仅承担握手鉴权 + 心跳维持，无应用层消息。
public final class DooPushWebSocketConnection: NSObject {
    public protocol Listener: AnyObject {
        func wsDidOpen()
        func wsDidClose(code: Int, reason: String?)
        func wsDidFail(_ error: Error)
    }

    private let baseUrl: String
    private let appId: String
    private let appKey: String
    private let token: String
    public weak var listener: Listener?

    private var session: URLSession!
    private var task: URLSessionWebSocketTask?
    private var pingTimer: DispatchSourceTimer?
    private var active = false
    private var reconnectDelay: TimeInterval = 1
    private let maxReconnectDelay: TimeInterval = 15

    public init(baseUrl: String, appId: String, appKey: String, token: String) {
        self.baseUrl = baseUrl
        self.appId = appId
        self.appKey = appKey
        self.token = token
        super.init()
        let cfg = URLSessionConfiguration.default
        self.session = URLSession(configuration: cfg, delegate: self, delegateQueue: nil)
    }

    public func connect() {
        guard !active else { return }
        active = true
        startTask()
    }

    public func disconnect() {
        active = false
        pingTimer?.cancel()
        pingTimer = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    private func startTask() {
        guard let url = makeURL() else { return }
        let t = session.webSocketTask(with: url)
        task = t
        t.resume()
        readLoop(t)
        startPing()
    }

    private func makeURL() -> URL? {
        let scheme = baseUrl.hasPrefix("https://") ? "wss://" : "ws://"
        let host = baseUrl
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var c = URLComponents(string: "\(scheme)\(host)/ws")
        c?.queryItems = [
            URLQueryItem(name: "appid", value: appId),
            URLQueryItem(name: "appkey", value: appKey),
            URLQueryItem(name: "token", value: token),
        ]
        return c?.url
    }

    private func readLoop(_ t: URLSessionWebSocketTask) {
        t.receive { [weak self] result in
            switch result {
            case .failure(let err):
                self?.handleFailure(err)
            case .success:
                // 应用层消息预留，本期忽略
                self?.readLoop(t)
            }
        }
    }

    private func startPing() {
        pingTimer?.cancel()
        let timer = DispatchSource.makeTimerSource()
        timer.schedule(deadline: .now() + 30, repeating: 30)
        timer.setEventHandler { [weak self] in
            self?.task?.sendPing { err in
                if let err = err { self?.handleFailure(err) }
            }
        }
        timer.resume()
        pingTimer = timer
    }

    private func handleFailure(_ error: Error) {
        guard active else { return }
        listener?.wsDidFail(error)
        // 鉴权失败 (HTTP 4xx) 不重连，由上层重新 register 拿新 token
        if let resp = task?.response as? HTTPURLResponse, (400..<500).contains(resp.statusCode) {
            return
        }
        scheduleReconnect()
    }

    private func scheduleReconnect() {
        let delay = reconnectDelay
        reconnectDelay = min(reconnectDelay * 2, maxReconnectDelay)
        DispatchQueue.global().asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self = self, self.active else { return }
            self.startTask()
        }
    }
}

extension DooPushWebSocketConnection: URLSessionWebSocketDelegate {
    public func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol p: String?) {
        reconnectDelay = 1
        listener?.wsDidOpen()
    }

    public func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith code: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        let reasonStr = reason.flatMap { String(data: $0, encoding: .utf8) }
        listener?.wsDidClose(code: code.rawValue, reason: reasonStr)
        // 不重连：4001 被新连挤掉、1000/1001 正常关闭
        // 重连：1008 (pong 超时) 与其他异常
        let raw = code.rawValue
        if active && raw != 4001 && raw != 1000 && raw != 1001 {
            scheduleReconnect()
        }
    }
}
```

- [ ] **Step 4：修改 DooPushManager.swift**

打开 `sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushManager.swift`，找原本初始化 `DooPushTCPConnection` 的位置（约 L25），改为 `DooPushWebSocketConnection`，构造参数对应 baseUrl / appId / appKey / token。删除接收 `gateway` 字段的反序列化代码。

- [ ] **Step 5：grep 确认**

```bash
cd sdk/ios
grep -rn "DooPushTCPConnection\|gateway_host\|gateway_port\|gateway_ssl" --include="*.swift" .
```

预期：无输出。

- [ ] **Step 6：编译 SDK**

```bash
cd sdk/ios/DooPushSDK
swift build
```

预期：Build complete!

- [ ] **Step 7：commit**

```bash
git add sdk/ios/
git commit -m "feat(sdk-ios): 替换 TCP 长连为 WebSocket，最低 iOS 提到 13"
```

---

## Task 13：nginx + .env 配置

**目标**：nginx 反代 `/ws` 到 `127.0.0.1:50000`；.env 删除三个无用 env。

**Files:**
- Modify: `conf/nginx.conf`
- Modify: `.env`
- Modify: `.env.example`（如存在）

- [ ] **Step 1：在 nginx.conf 添加 /ws location**

打开 `conf/nginx.conf`，在 server block 内（紧邻 `/api/` location 后）添加：

```nginx
location /ws {
    proxy_pass http://127.0.0.1:50000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    proxy_read_timeout 90s;
    proxy_send_timeout 90s;
    proxy_buffering off;
}
```

- [ ] **Step 2：从 .env 删除三个 env**

修改 `.env`（约 L27-30），删除：

```
GATEWAY_HOST=192.168.1.7
GATEWAY_PORT=5003
GATEWAY_SSL=false
```

如有 `.env.example` 同步删除。

- [ ] **Step 3：grep 确认**

```bash
grep -rn "GATEWAY_HOST\|GATEWAY_PORT\|GATEWAY_SSL" --include="*.go" --include="*.conf" --include=".env*" .
```

预期：无输出（gateway 包内的端口已写死为常量 50000）。

- [ ] **Step 4：reload nginx 验证**

```bash
sudo nginx -t && sudo nginx -s reload
```

预期：`syntax is ok` + `test is successful`。

- [ ] **Step 5：commit**

```bash
git add conf/nginx.conf .env .env.example
git commit -m "chore(deploy): nginx 新增 /ws 反代，移除 GATEWAY_* env"
```

---

## Task 14：端到端联调

**目标**：经 nginx → gateway 全链路验证 SDK demo 能连上、心跳维持、断开能清理在线态。

**Files:** none

- [ ] **Step 1：启动全栈**

```bash
# 假设 supervisord 已 reload
sudo supervisorctl restart doopush-gateway
sudo nginx -s reload
```

- [ ] **Step 2：经 nginx 用 wscat 测**

```bash
wscat -c "wss://<API_HOST>/ws?appid=<APP_ID>&appkey=<APP_KEY>&token=<TOKEN>"
```

预期：成功连接。让它挂着 2 分钟。

- [ ] **Step 3：观察心跳**

在另一终端：

```bash
sudo tcpdump -i any -A "tcp port 50000" 2>&1 | head -100
```

预期：每 30 秒看到 WebSocket Ping/Pong frame。

- [ ] **Step 4：验证 Redis & MySQL 在线态**

同 Task 8 Step 5-7。

- [ ] **Step 5：拉起 Android demo**

```bash
cd sdk/android/DooPushSDKExample
./gradlew :app:installDebug
```

在真机/模拟器上启动 app，确认：
- 连上后立即 onOpen
- 后台 ≥2 分钟 → 仍在线
- 切换网络（wifi↔4G）→ 自动重连成功
- 改错 token 重启 → onClosed code 不触发重连

- [ ] **Step 6：拉起 iOS demo**

打开 `sdk/ios/DooPushSDKExample/DooPushSDKExample.xcodeproj`，跑 demo app，做同样验证。

- [ ] **Step 7：双连互踢测试**

同一台设备装 Android demo 和 iOS demo，两端用同一 token 同时连：

预期：先连上的端收到 close code 4001，**不重连**；后连上的端正常在线。

无需 commit。

---

## Task 15：清理与 final commit

**目标**：清理任何遗留代码、重新过一遍 grep、整理 commit。

- [ ] **Step 1：grep 确认无 gnet / TCP 残留**

```bash
grep -rn "gnet\|panjf2000\|tcp://\|MSG_PING\|MSG_PONG\|MSG_REGISTER" \
  --include="*.go" --include="*.kt" --include="*.swift" .
```

预期：无输出（API 文档里若有"TCP"字样视作残留待修，但本期不强求改文档）。

- [ ] **Step 2：跑一次 go test**

```bash
cd api
go test ./internal/gateway/... -v
```

预期：所有 unit test PASS。

- [ ] **Step 3：检查 git status & log**

```bash
git status
git log --oneline -20
```

预期：工作区干净；最近 commit 形成清晰的迁移叙事。

---

## 验收清单

- [ ] gateway 进程监听 `127.0.0.1:50000`，外网通过 nginx `/ws` 访问
- [ ] 握手鉴权三参（appid/appkey/token）正确返回 400/401/403
- [ ] 握手成功后 Redis `device_online:<token>` 写入；断开后清理
- [ ] MySQL `devices.is_online` 随连接状态切换；`gateway_node` / `connection_id` 列已删除
- [ ] WS 30s 间隔 Ping/Pong；75s 无响应触发服务端 Close
- [ ] 同 token 二次连接：旧连收到 close code 4001
- [ ] Android / iOS demo 端到端通过：连上、心跳、断网重连、鉴权失败不重连
- [ ] `go.mod` 不含 `gnet/v2`，含 `coder/websocket`
- [ ] `.env` 不含 `GATEWAY_HOST` / `GATEWAY_PORT` / `GATEWAY_SSL`
- [ ] 旧 5003 端口防火墙已关闭

---

## 自检清单（writing-plans skill）

执行前已自检：

- **Spec 覆盖**：spec 的每节均映射到至少一个 Task（鉴权 → T2 / T8；连接管理 → T3 / T5；在线态 → T4 / T8 / T14；删除清单 → T9 / T10 / T13；nginx 反代 → T13；SDK 改动 → T11 / T12；测试 → T8 / T14）。
- **占位符**：无 TODO / TBD / "类似 Task X" 占位文本；Task 9 与 Task 11 中的少量"按现有结构调整"措辞已伴随具体行号定位 + 改法模板。
- **类型一致**：`HandshakeParams` / `closer` / `wsConn` / `Handler` 在多 Task 中签名统一；`MarkOnline` / `MarkOffline` / `RefreshOnlineTTL` 命名贯穿。
- **范围**：单一目标（TCP→WS 协议替换），单计划完成；不涉及多子系统。
