package gateway

import (
	"log"

	_ "github.com/coder/websocket" // pre-declare dependency; import will be used in T2+
)

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
