package gateway

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/redisclient"
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

	rdb, err := redisclient.New()
	if err != nil {
		return nil, err
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
	// 同步清零历史在线态：必须在监听前完成，否则会与首个 device 的 MarkOnline 竞态
	if err := services.NewDeviceService().SetAllDevicesOffline(); err != nil {
		log.Printf("清零在线态失败: %v", err)
	}

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

	// 1. 停止接受新连接
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = s.srv.Shutdown(ctx)

	// 2. 关闭所有 WS 连接并等待清理（http.Server.Shutdown 不会等 hijacked 连接）
	s.handler.Shutdown(10 * time.Second)

	// 3. 释放底层依赖
	_ = s.rdb.Close()
}

// GetPort 从 ListenAddr 解析端口，给开发期 KillProcessByPort 用
func (s *GatewayServer) GetPort() int {
	_, portStr, err := net.SplitHostPort(ListenAddr)
	if err != nil {
		return 0
	}
	p, _ := strconv.Atoi(portStr)
	return p
}
