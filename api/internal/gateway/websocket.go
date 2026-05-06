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
	// 派生可取消的 ctx：run 一旦返回，两个子 goroutine 都能从 ctx.Done() 收敛退出
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

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
				pctx, c2 := context.WithTimeout(ctx, pongTimeout)
				err := w.c.Ping(pctx)
				c2()
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
		// reader 异常通常意味着对端断开；立刻清理在线态，避免最长 30s 的幽灵在线
		w.CloseWith(int(websocket.StatusNormalClosure), "reader exit")
	case err := <-pingErr:
		log.Printf("ws ping exit token=%s: %v", w.token, err)
		w.CloseWith(int(websocket.StatusPolicyViolation), "pong timeout")
	}
}
