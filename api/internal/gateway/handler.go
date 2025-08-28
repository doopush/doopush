package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/utils"
	"github.com/panjf2000/gnet/v2"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// GatewayHandler gnet 事件处理器
type GatewayHandler struct {
	gnet.BuiltinEventEngine

	// 配置
	config *GatewayConfig

	// 连接管理
	connections sync.Map // connID -> *Connection
	deviceConns sync.Map // deviceToken -> connID
	connCounter int64    // 连接计数器

	// Redis 客户端
	redisClient *redis.Client

	// 统计信息
	stats *GatewayStats

	// 启动时间
	startTime time.Time
}

// Connection 连接信息
type Connection struct {
	ID           string    `json:"id"`
	DeviceToken  string    `json:"device_token"`
	AppID        uint      `json:"app_id"`
	Platform     string    `json:"platform"`
	RemoteAddr   string    `json:"remote_addr"`
	ConnTime     time.Time `json:"conn_time"`
	LastPing     time.Time `json:"last_ping"`
	MessageCount int64     `json:"message_count"`
	Status       string    `json:"status"` // "connected", "registered", "expired"
}

// GatewayStats 网关统计信息
type GatewayStats struct {
	ActiveConnections int64     `json:"active_connections"`
	TotalMessages     int64     `json:"total_messages"`
	Uptime            int64     `json:"uptime"`
	StartTime         time.Time `json:"start_time"`
}

// Message 消息结构
type Message struct {
	Type    byte   `json:"type"`
	AppID   uint   `json:"app_id,omitempty"`
	Token   string `json:"token,omitempty"`
	Payload []byte `json:"payload,omitempty"`
}

// 消息类型常量
const (
	MSG_PING     = 0x01 // 心跳请求
	MSG_PONG     = 0x02 // 心跳响应
	MSG_REGISTER = 0x03 // 设备注册
	MSG_ACK      = 0x04 // 注册确认
	MSG_PUSH     = 0x05 // 推送消息
	MSG_ERROR    = 0xFF // 错误消息
)

// NewGatewayHandler 创建网关处理器
func NewGatewayHandler(config *GatewayConfig, redisClient *redis.Client) *GatewayHandler {
	return &GatewayHandler{
		config:      config,
		redisClient: redisClient,
		stats: &GatewayStats{
			StartTime: time.Now(),
		},
		startTime: time.Now(),
	}
}

// OnBoot gnet 启动回调
func (h *GatewayHandler) OnBoot(eng gnet.Engine) gnet.Action {
	log.Printf("网关处理器启动完成")
	log.Printf("节点ID: %s", h.config.NodeID)
	log.Printf("网关端口: %d", h.config.Port)

	return gnet.None
}

// OnOpen 新连接建立时的回调
func (h *GatewayHandler) OnOpen(c gnet.Conn) ([]byte, gnet.Action) {
	connID := h.generateConnID()

	conn := &Connection{
		ID:         connID,
		RemoteAddr: c.RemoteAddr().String(),
		ConnTime:   time.Now(),
		LastPing:   time.Now(),
		Status:     "connected",
	}

	// 保存连接
	c.SetContext(conn)
	h.connections.Store(connID, conn)

	// 更新统计
	atomic.AddInt64(&h.stats.ActiveConnections, 1)

	log.Printf("设备连接建立 - ConnID: %s, RemoteAddr: %s, 当前连接数: %d",
		connID, conn.RemoteAddr, atomic.LoadInt64(&h.stats.ActiveConnections))

	return nil, gnet.None
}

// OnClose 连接关闭时的回调
func (h *GatewayHandler) OnClose(c gnet.Conn, err error) gnet.Action {
	if conn, ok := c.Context().(*Connection); ok {
		// 设备下线处理
		h.handleDeviceOffline(conn)

		// 删除连接
		h.connections.Delete(conn.ID)
		if conn.DeviceToken != "" {
			h.deviceConns.Delete(conn.DeviceToken)
		}

		// 更新统计
		atomic.AddInt64(&h.stats.ActiveConnections, -1)

		log.Printf("设备连接关闭 - ConnID: %s, DeviceToken: %s, 当前连接数: %d, 错误: %v",
			conn.ID, conn.DeviceToken, atomic.LoadInt64(&h.stats.ActiveConnections), err)
	}

	return gnet.None
}

// OnTraffic 数据传输时的回调
func (h *GatewayHandler) OnTraffic(c gnet.Conn) gnet.Action {
	// 读取所有可用数据
	data, _ := c.Next(-1)
	if len(data) == 0 {
		return gnet.None
	}

	conn := c.Context().(*Connection)
	conn.LastPing = time.Now()
	atomic.AddInt64(&conn.MessageCount, 1)
	atomic.AddInt64(&h.stats.TotalMessages, 1)

	// 解析消息
	msg, err := h.parseMessage(data)
	if err != nil {
		log.Printf("消息解析失败 - ConnID: %s, Error: %v", conn.ID, err)
		return h.sendError(c, "消息格式错误")
	}

	fmt.Printf("消息: %+v\n", msg)

	// 处理消息
	return h.handleMessage(c, conn, msg)
}

// parseMessage 解析消息
func (h *GatewayHandler) parseMessage(data []byte) (*Message, error) {
	if len(data) < 1 {
		return nil, fmt.Errorf("消息长度不足")
	}

	msg := &Message{
		Type: data[0],
	}

	// 如果有payload，尝试解析JSON
	if len(data) > 1 {
		if err := json.Unmarshal(data[1:], msg); err != nil {
			// 如果JSON解析失败，将剩余数据作为原始payload
			msg.Payload = data[1:]
		}
	}

	return msg, nil
}

// handleMessage 处理消息
func (h *GatewayHandler) handleMessage(c gnet.Conn, conn *Connection, msg *Message) gnet.Action {
	switch msg.Type {
	case MSG_PING:
		return h.handleHeartbeat(c, conn, msg)
	case MSG_REGISTER:
		return h.handleRegister(c, conn, msg)
	default:
		log.Printf("未知消息类型 - ConnID: %s, Type: 0x%02x", conn.ID, msg.Type)
		return h.sendError(c, "未知消息类型")
	}
}

// handleHeartbeat 处理心跳
func (h *GatewayHandler) handleHeartbeat(c gnet.Conn, conn *Connection, msg *Message) gnet.Action {
	// 更新心跳时间
	conn.LastPing = time.Now()

	// 如果设备已注册，更新Redis中的心跳时间
	if conn.DeviceToken != "" && conn.Status == "registered" {
		h.updateDeviceHeartbeat(conn.DeviceToken)
	}

	// 发送PONG响应
	pongData := []byte{MSG_PONG}
	c.Write(pongData)

	return gnet.None
}

// handleRegister 处理设备注册
func (h *GatewayHandler) handleRegister(c gnet.Conn, conn *Connection, msg *Message) gnet.Action {
	// 验证注册信息
	if msg.AppID == 0 || msg.Token == "" {
		log.Printf("设备注册信息不完整 - ConnID: %s, AppID: %d, Token: %s",
			conn.ID, msg.AppID, msg.Token)
		return h.sendError(c, "注册信息不完整")
	}

	// TODO: 调用API服务验证设备有效性
	// 这里先简单验证，后续可以通过HTTP调用API服务
	if !h.validateDevice(msg.AppID, msg.Token) {
		log.Printf("设备验证失败 - ConnID: %s, AppID: %d, Token: %s",
			conn.ID, msg.AppID, msg.Token)
		return h.sendError(c, "设备验证失败")
	}

	// 更新连接信息
	conn.DeviceToken = msg.Token
	conn.AppID = msg.AppID
	conn.Status = "registered"

	// 保存设备连接映射
	h.deviceConns.Store(msg.Token, conn.ID)

	// 更新Redis中的设备状态
	h.updateDeviceStatus(conn)

	// 更新数据库中的设备在线状态和最后活跃时间
	h.updateDeviceDatabase(conn, true)

	log.Printf("设备注册成功 - ConnID: %s, AppID: %d, Token: %s",
		conn.ID, msg.AppID, msg.Token)

	// 发送ACK响应
	ackData := []byte{MSG_ACK, 1} // 1 表示成功
	c.Write(ackData)

	return gnet.None
}

// validateDevice 验证设备是否存在且有效
func (h *GatewayHandler) validateDevice(appID uint, deviceToken string) bool {
	if appID == 0 || deviceToken == "" {
		return false
	}

	// 验证应用是否存在且启用
	var app models.App
	if err := database.DB.Where("id = ? AND status = 1", appID).First(&app).Error; err != nil {
		log.Printf("应用验证失败 - AppID: %d, Error: %v", appID, err)
		return false
	}

	// 计算token哈希
	tokenHash := utils.HashString(deviceToken)

	// 查询设备是否存在
	var device models.Device
	err := database.DB.Where("app_id = ? AND token_hash = ?", appID, tokenHash).First(&device).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Printf("设备不存在 - AppID: %d, DeviceToken: %s", appID, deviceToken)
			return false
		}
		log.Printf("设备查询失败 - AppID: %d, Error: %v", appID, err)
		return false
	}

	// 设备存在且状态正常
	return device.Status == 1
}

// updateDeviceStatus 更新设备在线状态到Redis
func (h *GatewayHandler) updateDeviceStatus(conn *Connection) {
	deviceKey := fmt.Sprintf("device_online:%s", conn.DeviceToken)
	deviceData := map[string]interface{}{
		"online":         true,
		"gateway_node":   h.config.NodeID,
		"connection_id":  conn.ID,
		"app_id":         conn.AppID,
		"last_heartbeat": time.Now().Unix(),
		"remote_addr":    conn.RemoteAddr,
		"conn_time":      conn.ConnTime.Unix(),
	}

	ctx := context.Background()
	if err := h.redisClient.HMSet(ctx, deviceKey, deviceData).Err(); err != nil {
		log.Printf("更新设备状态失败 - DeviceToken: %s, Error: %v", conn.DeviceToken, err)
		return
	}

	// 设置2小时过期时间
	h.redisClient.Expire(ctx, deviceKey, 2*time.Hour)
}

// updateDeviceHeartbeat 更新设备心跳时间
func (h *GatewayHandler) updateDeviceHeartbeat(deviceToken string) {
	deviceKey := fmt.Sprintf("device_online:%s", deviceToken)
	ctx := context.Background()

	h.redisClient.HSet(ctx, deviceKey, "last_heartbeat", time.Now().Unix())
}

// handleDeviceOffline 处理设备下线
func (h *GatewayHandler) handleDeviceOffline(conn *Connection) {
	if conn.DeviceToken == "" {
		return
	}

	// 从Redis中删除设备在线状态
	deviceKey := fmt.Sprintf("device_online:%s", conn.DeviceToken)
	ctx := context.Background()

	if err := h.redisClient.Del(ctx, deviceKey).Err(); err != nil {
		log.Printf("删除设备在线状态失败 - DeviceToken: %s, Error: %v", conn.DeviceToken, err)
	}

	// 更新数据库中的设备离线状态
	h.updateDeviceDatabase(conn, false)
}

// sendError 发送错误消息
func (h *GatewayHandler) sendError(c gnet.Conn, message string) gnet.Action {
	errorData := []byte{MSG_ERROR}
	errorData = append(errorData, []byte(message)...)
	c.Write(errorData)
	return gnet.Close
}

// generateConnID 生成连接ID
func (h *GatewayHandler) generateConnID() string {
	connNum := atomic.AddInt64(&h.connCounter, 1)
	return fmt.Sprintf("%s-%d-%d", h.config.NodeID, time.Now().Unix(), connNum)
}

// GetStats 获取统计信息
func (h *GatewayHandler) GetStats() *GatewayStats {
	h.stats.Uptime = time.Since(h.startTime).Nanoseconds()
	return h.stats
}

// CleanupExpiredConnections 清理过期连接
func (h *GatewayHandler) CleanupExpiredConnections() {
	expiredThreshold := time.Now().Add(-5 * time.Minute) // 5分钟无活动认为过期
	expiredCount := 0

	h.connections.Range(func(key, value interface{}) bool {
		conn := value.(*Connection)
		if conn.LastPing.Before(expiredThreshold) {
			// 连接过期，标记为过期状态
			conn.Status = "expired"
			expiredCount++

			// 清理设备映射
			if conn.DeviceToken != "" {
				h.deviceConns.Delete(conn.DeviceToken)
				h.handleDeviceOffline(conn)
			}
		}
		return true
	})

	if expiredCount > 0 {
		log.Printf("清理过期连接: %d个", expiredCount)
	}
}

// updateDeviceDatabase 更新数据库中的设备状态
func (h *GatewayHandler) updateDeviceDatabase(conn *Connection, online bool) {
	if conn.DeviceToken == "" {
		return
	}

	// 异步更新数据库，避免阻塞网络处理
	go func() {
		tokenHash := utils.HashString(conn.DeviceToken)
		now := time.Now()

		// 准备更新数据
		updates := map[string]interface{}{
			"is_online":      online,
			"last_seen":      &now,
			"last_heartbeat": &now,
		}

		// 如果是上线，还要更新网关节点和连接ID
		if online {
			updates["gateway_node"] = h.config.NodeID
			updates["connection_id"] = conn.ID
		} else {
			// 下线时清空网关节点和连接ID
			updates["gateway_node"] = ""
			updates["connection_id"] = ""
		}

		// 更新设备记录
		result := database.DB.Model(&models.Device{}).
			Where("app_id = ? AND token_hash = ?", conn.AppID, tokenHash).
			Updates(updates)

		if result.Error != nil {
			log.Printf("更新设备状态失败 - DeviceToken: %s, Online: %v, Error: %v",
				conn.DeviceToken, online, result.Error)
			return
		}

		if result.RowsAffected == 0 {
			log.Printf("设备不存在，无法更新状态 - DeviceToken: %s", conn.DeviceToken)
			return
		}

		log.Printf("设备状态更新成功 - DeviceToken: %s, Online: %v, Gateway: %s",
			conn.DeviceToken, online, h.config.NodeID)
	}()
}
