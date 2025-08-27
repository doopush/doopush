package cmd

import (
	"log"
	"strconv"

	"github.com/doopush/doopush/api/internal/config"
	"github.com/doopush/doopush/api/internal/controllers"
	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/middleware"
	"github.com/doopush/doopush/api/pkg/utils"

	_ "github.com/doopush/doopush/api/docs"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "启动API服务器",
	Run: func(cmd *cobra.Command, args []string) {
		// 获取环境文件路径
		envFile, _ := cmd.Flags().GetString("env-file")
		if envFile == "" {
			log.Fatal("必须指定环境文件: --env-file .env")
		}

		// 加载配置文件
		config.LoadConfig(envFile)

		// 连接数据库
		database.Connect()
		database.AutoMigrate()

		// 启动服务器
		startServer()
	},
}

func init() {
	rootCmd.AddCommand(serveCmd)
	serveCmd.Flags().StringP("env-file", "e", "", "环境变量文件路径 (必需)")
	serveCmd.MarkFlagRequired("env-file")
}

func startServer() {
	// 设置Gin模式
	if config.GetString("APP_ENV") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 创建Gin引擎
	r := gin.Default()

	// 全局中间件
	r.Use(middleware.CORS())

	// 静态文件服务
	r.Static("/uploads", "./uploads")

	// 控制器
	healthCtrl := controllers.NewHealthController()
	authCtrl := controllers.NewAuthController()
	appCtrl := controllers.NewAppController()
	deviceCtrl := controllers.NewDeviceController()
	pushCtrl := controllers.NewPushController()
	configCtrl := controllers.NewConfigController()
	templateCtrl := controllers.NewTemplateController()
	tagCtrl := controllers.NewTagController()
	groupCtrl := controllers.NewGroupController()
	schedulerCtrl := controllers.NewSchedulerController()
	auditCtrl := controllers.NewAuditController()
	uploadCtrl := controllers.NewUploadController()

	// 基础路由 (无需认证)
	r.GET("/health", healthCtrl.Check)

	// API路由组
	api := r.Group("/api/v1")
	{
		// 健康检查
		api.GET("/health", healthCtrl.Check)

		// 认证相关 (无需认证)
		auth := api.Group("/auth")
		{
			auth.POST("/register", authCtrl.Register)
			auth.POST("/login", authCtrl.Login)
		}

		// 需要JWT认证的路由
		authenticated := api.Group("")
		authenticated.Use(middleware.JWTAuth())
		{
			// 用户信息
			authenticated.GET("/auth/profile", authCtrl.Profile)
			authenticated.PUT("/auth/profile", authCtrl.UpdateProfile)
			authenticated.PUT("/auth/password", authCtrl.ChangePassword)
			authenticated.GET("/auth/apps", authCtrl.UserApps)

			// 文件上传
			authenticated.POST("/upload/image", uploadCtrl.UploadImage)
			authenticated.DELETE("/upload/delete", uploadCtrl.DeleteUploadedFile)
			authenticated.GET("/upload/files", uploadCtrl.GetUserFiles)

			// 应用管理
			authenticated.POST("/apps", appCtrl.CreateApp)
			authenticated.GET("/apps", appCtrl.GetApps)
			authenticated.GET("/apps/:appId", appCtrl.GetApp)
			authenticated.PUT("/apps/:appId", appCtrl.UpdateApp)
			authenticated.DELETE("/apps/:appId", appCtrl.DeleteApp)

			// API密钥管理
			authenticated.GET("/apps/:appId/api-keys", appCtrl.GetAppAPIKeys)
			authenticated.POST("/apps/:appId/api-keys", appCtrl.CreateAPIKey)
			authenticated.DELETE("/apps/:appId/api-keys/:keyId", appCtrl.DeleteAPIKey)

			// 设备管理
			authenticated.GET("/apps/:appId/devices", deviceCtrl.GetDevices)
			authenticated.GET("/apps/:appId/devices/:deviceId", deviceCtrl.GetDevice)
			authenticated.PUT("/apps/:appId/devices/:deviceId/status", deviceCtrl.UpdateDeviceStatus)
			authenticated.DELETE("/apps/:appId/devices/:deviceId", deviceCtrl.DeleteDevice)

			// 推送管理
			authenticated.POST("/apps/:appId/push", pushCtrl.SendPush)
			authenticated.POST("/apps/:appId/push/single", pushCtrl.SendSingle)
			authenticated.POST("/apps/:appId/push/batch", pushCtrl.SendBatch)
			authenticated.POST("/apps/:appId/push/broadcast", pushCtrl.SendBroadcast)
			authenticated.GET("/apps/:appId/push/logs", pushCtrl.GetPushLogs)
			authenticated.GET("/apps/:appId/push/logs/:logId", pushCtrl.GetPushLogDetails)
			authenticated.GET("/apps/:appId/push/statistics", pushCtrl.GetPushStatistics)

			// 应用配置管理
			authenticated.GET("/apps/:appId/config", configCtrl.GetAppConfigs)
			authenticated.POST("/apps/:appId/config", configCtrl.SetAppConfig)
			authenticated.PUT("/apps/:appId/config/:configId", configCtrl.UpdateAppConfig)
			authenticated.DELETE("/apps/:appId/config/:configId", configCtrl.DeleteAppConfig)
			authenticated.POST("/apps/:appId/config/test", configCtrl.TestAppConfig)

			// 消息模板管理
			authenticated.GET("/apps/:appId/templates", templateCtrl.GetTemplates)
			authenticated.POST("/apps/:appId/templates", templateCtrl.CreateTemplate)
			authenticated.GET("/apps/:appId/templates/:id", templateCtrl.GetTemplate)
			authenticated.PUT("/apps/:appId/templates/:id", templateCtrl.UpdateTemplate)
			authenticated.DELETE("/apps/:appId/templates/:id", templateCtrl.DeleteTemplate)
			authenticated.POST("/apps/:appId/templates/:id/render", templateCtrl.RenderTemplate)

			// 用户标签管理
			authenticated.GET("/apps/:appId/users/:userId/tags", tagCtrl.GetUserTags)
			authenticated.POST("/apps/:appId/users/:userId/tags", tagCtrl.AddUserTag)
			authenticated.DELETE("/apps/:appId/users/:userId/tags/:tagName", tagCtrl.DeleteUserTag)
			authenticated.GET("/apps/:appId/tags", tagCtrl.GetAppTagStatistics)

			// 设备分组管理
			authenticated.GET("/apps/:appId/device-groups", groupCtrl.GetGroups)
			authenticated.POST("/apps/:appId/device-groups", groupCtrl.CreateGroup)
			authenticated.GET("/apps/:appId/device-groups/:id", groupCtrl.GetGroup)
			authenticated.PUT("/apps/:appId/device-groups/:id", groupCtrl.UpdateGroup)
			authenticated.DELETE("/apps/:appId/device-groups/:id", groupCtrl.DeleteGroup)

			// 定时推送管理
			authenticated.GET("/apps/:appId/scheduled-pushes", schedulerCtrl.GetScheduledPushes)
			authenticated.GET("/apps/:appId/scheduled-pushes/stats", schedulerCtrl.GetScheduledPushStats)
			authenticated.POST("/apps/:appId/scheduled-pushes", schedulerCtrl.CreateScheduledPush)
			authenticated.GET("/apps/:appId/scheduled-pushes/:id", schedulerCtrl.GetScheduledPush)
			authenticated.PUT("/apps/:appId/scheduled-pushes/:id", schedulerCtrl.UpdateScheduledPush)
			authenticated.DELETE("/apps/:appId/scheduled-pushes/:id", schedulerCtrl.DeleteScheduledPush)
			authenticated.POST("/apps/:appId/scheduled-pushes/:id/pause", schedulerCtrl.PauseScheduledPush)
			authenticated.POST("/apps/:appId/scheduled-pushes/:id/resume", schedulerCtrl.ResumeScheduledPush)
			authenticated.POST("/apps/:appId/scheduled-pushes/:id/execute", schedulerCtrl.ExecuteScheduledPush)

			// 审计日志管理
			authenticated.GET("/audit-logs", auditCtrl.GetGlobalAuditLogs)
			authenticated.GET("/audit-logs/statistics", auditCtrl.GetActionStatistics)
			authenticated.GET("/apps/:appId/audit-logs", auditCtrl.GetAppAuditLogs)
		}

		// API Key认证的路由 (供客户端SDK使用)
		apiKeyRoutes := api.Group("")
		apiKeyRoutes.Use(middleware.APIKeyAuth())
		{
			apiKeyRoutes.POST("/apps/:appId/devices", deviceCtrl.RegisterDevice)
		}
	}

	// Swagger文档
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// 启动服务器
	port := config.GetString("API_PORT")
	if port == "" {
		port = "5002"
	}

	// 开发环境启动时根据端口结束进程
	if config.GetString("APP_ENV") == "development" {
		if portInt, err := strconv.Atoi(port); err == nil {
			utils.KillProcessByPort(portInt)
		}
	}

	log.Printf("服务器启动在端口: %s", port)
	log.Printf("Swagger文档: http://localhost:%s/swagger/index.html", port)

	if err := r.Run(":" + port); err != nil {
		log.Fatal("服务器启动失败:", err)
	}
}
