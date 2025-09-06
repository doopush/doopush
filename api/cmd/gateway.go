package cmd

import (
	"log"

	"github.com/doopush/doopush/api/internal/config"
	"github.com/doopush/doopush/api/internal/gateway"
	"github.com/doopush/doopush/api/pkg/utils"

	"github.com/spf13/cobra"
)

var gatewayCmd = &cobra.Command{
	Use:   "gateway",
	Short: "启动网关服务器",
	Long:  "启动高性能长连接网关服务器，用于设备实时连接和状态管理",
	Run: func(cmd *cobra.Command, args []string) {
		// 加载配置文件
		envFile, _ := cmd.Flags().GetString("env-file")
		if envFile != "" {
			config.LoadConfig(envFile)
		}

		// 启动网关服务器
		startGateway()
	},
}

func init() {
	rootCmd.AddCommand(gatewayCmd)
	gatewayCmd.Flags().StringP("env-file", "e", "", "环境变量文件路径 (可选)")
}

func startGateway() {
	log.Println("正在启动网关服务器...")

	// 创建并启动网关服务器
	server, err := gateway.NewGatewayServer()
	if err != nil {
		log.Fatal("网关服务器创建失败:", err)
	}

	// 开发环境启动时根据端口结束进程
	if config.GetString("APP_ENV", "development") == "development" {
		utils.KillProcessByPort(server.GetPort())
	}

	if err := server.Start(); err != nil {
		log.Fatal("网关服务器启动失败:", err)
	}
}
