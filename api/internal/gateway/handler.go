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
	params, _, err := AuthenticateRequest(r)
	if err != nil {
		http.Error(w, err.Error(), HTTPStatus(err))
		return
	}

	// 2. 升级
	c, accErr := websocket.Accept(w, r, &websocket.AcceptOptions{
		// SDK 与 gateway 同源走 nginx，不做跨域校验；
		// nginx 已处理 Origin，这里关闭 server 端校验
		InsecureSkipVerify: true,
	})
	if accErr != nil {
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
