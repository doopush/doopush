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
	"github.com/panjf2000/gnet/v2"
	"github.com/redis/go-redis/v9"
)

// GatewayServer 网关服务器
type GatewayServer struct {
	config      *GatewayConfig
	handler     *GatewayHandler
	redisClient *redis.Client
	server      gnet.Engine
}

// GatewayConfig 网关配置
type GatewayConfig struct {
	NodeID         string
	Port           int
	MaxConnections int
	MetricsPort    int

	// Redis 配置
	RedisAddr     string
	RedisPassword string
	RedisDB       int
}

// NewGatewayServer 创建网关服务器
func NewGatewayServer() (*GatewayServer, error) {
	// 从环境变量加载配置
	cfg, err := loadGatewayConfig()
	if err != nil {
		return nil, fmt.Errorf("加载配置失败: %w", err)
	}

	// 连接数据库
	database.Connect()

	// 创建 Redis 客户端
	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})

	// 测试 Redis 连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("Redis 连接失败: %w", err)
	}

	// 创建处理器
	handler := NewGatewayHandler(cfg, redisClient)

	server := &GatewayServer{
		config:      cfg,
		handler:     handler,
		redisClient: redisClient,
	}

	log.Printf("网关服务器配置加载完成:")
	log.Printf("  节点ID: %s", cfg.NodeID)
	log.Printf("  监听端口: %d", cfg.Port)
	log.Printf("  最大连接数: %d", cfg.MaxConnections)
	log.Printf("  Redis地址: %s", cfg.RedisAddr)
	log.Printf("  监控端口: %d", cfg.MetricsPort)
	log.Printf("  数据库连接: 已建立")

	return server, nil
}

// Start 启动网关服务器
func (s *GatewayServer) Start() error {
	// 启动监控服务器
	go s.startMetricsServer()

	// 启动心跳检测和统计任务
	go s.startBackgroundTasks()

	// 网关地址
	addr := fmt.Sprintf("tcp://:%d", s.config.Port)

	log.Printf("网关服务器启动中...")
	log.Printf("监听地址: %s", addr)

	// 启动 gnet 服务器
	err := gnet.Run(s.handler, addr,
		gnet.WithMulticore(true),                // 多核支持
		gnet.WithReusePort(true),                // 端口复用
		gnet.WithSocketRecvBuffer(64*1024),      // 接收缓冲区 64KB
		gnet.WithSocketSendBuffer(64*1024),      // 发送缓冲区 64KB
		gnet.WithTCPKeepAlive(time.Minute*2),    // TCP Keep-Alive
		gnet.WithTCPNoDelay(gnet.TCPNoDelay),    // 禁用 Nagle 算法
		gnet.WithLoadBalancing(gnet.RoundRobin), // 负载均衡
	)

	if err != nil {
		return fmt.Errorf("网关服务器启动失败: %w", err)
	}

	return nil
}

// startMetricsServer 启动监控指标服务器
func (s *GatewayServer) startMetricsServer() {
	if s.config.MetricsPort == 0 {
		return
	}

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	http.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		// 简单的指标输出
		stats := s.handler.GetStats()
		fmt.Fprintf(w, "# TYPE gateway_active_connections gauge\n")
		fmt.Fprintf(w, "gateway_active_connections{node_id=\"%s\"} %d\n",
			s.config.NodeID, stats.ActiveConnections)
		fmt.Fprintf(w, "# TYPE gateway_total_messages counter\n")
		fmt.Fprintf(w, "gateway_total_messages{node_id=\"%s\"} %d\n",
			s.config.NodeID, stats.TotalMessages)
	})

	addr := fmt.Sprintf(":%d", s.config.MetricsPort)
	log.Printf("监控服务器启动: http://localhost%s", addr)
	log.Printf("健康检查: http://localhost%s/health", addr)
	log.Printf("指标接口: http://localhost%s/metrics", addr)

	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Printf("监控服务器启动失败: %v", err)
	}
}

// startBackgroundTasks 启动后台任务
func (s *GatewayServer) startBackgroundTasks() {
	// 等待服务器启动
	time.Sleep(2 * time.Second)

	// 定期清理过期连接（每30秒）
	connectionCleanupTicker := time.NewTicker(30 * time.Second)
	go func() {
		for range connectionCleanupTicker.C {
			s.handler.CleanupExpiredConnections()
		}
	}()

	// 定期更新节点状态（每10秒）
	nodeUpdateTicker := time.NewTicker(10 * time.Second)
	go func() {
		for range nodeUpdateTicker.C {
			s.updateNodeStatus()
		}
	}()

	// 处理优雅关闭
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)

	<-sigCh
	log.Println("收到关闭信号，正在优雅关闭...")

	connectionCleanupTicker.Stop()
	nodeUpdateTicker.Stop()
	s.redisClient.Close()
}

// updateNodeStatus 更新节点状态到 Redis
func (s *GatewayServer) updateNodeStatus() {
	stats := s.handler.GetStats()

	nodeKey := fmt.Sprintf("gateway_node:%s", s.config.NodeID)
	nodeData := map[string]interface{}{
		"host":               "localhost", // TODO: 获取实际主机信息
		"port":               s.config.Port,
		"active_connections": stats.ActiveConnections,
		"max_connections":    s.config.MaxConnections,
		"total_messages":     stats.TotalMessages,
		"uptime":             stats.Uptime,
		"last_update":        time.Now().Unix(),
	}

	ctx := context.Background()
	if err := s.redisClient.HMSet(ctx, nodeKey, nodeData).Err(); err != nil {
		log.Printf("更新节点状态失败: %v", err)
		return
	}

	// 设置过期时间为30秒，如果节点宕机会自动清理
	s.redisClient.Expire(ctx, nodeKey, 30*time.Second)
}

// loadGatewayConfig 从环境变量加载网关配置
func loadGatewayConfig() (*GatewayConfig, error) {
	cfg := &GatewayConfig{
		NodeID:         config.GetString("GATEWAY_NODE_ID", "gateway-default"), // 节点ID
		Port:           config.GetInt("GATEWAY_PORT", 5003),                    // 端口
		MaxConnections: config.GetInt("GATEWAY_MAX_CONNECTIONS", 100000),       // 最大连接数
		MetricsPort:    config.GetInt("GATEWAY_METRICS_PORT", 0),               // 监控端口

		RedisAddr:     fmt.Sprintf("%s:%s", config.GetString("REDIS_HOST"), config.GetString("REDIS_PORT")), // Redis地址
		RedisPassword: config.GetString("REDIS_PASSWORD"),                                                   // Redis密码
		RedisDB:       config.GetInt("REDIS_DB"),                                                            // Redis数据库
	}

	return cfg, nil
}

// GetPort 获取端口
func (s *GatewayServer) GetPort() int {
	return s.config.Port
}
