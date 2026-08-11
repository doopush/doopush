package cmd

import (
	"log"
	"strconv"

	"github.com/doopush/doopush/api/internal/config"
	"github.com/doopush/doopush/api/internal/controllers"
	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/middleware"
	"github.com/doopush/doopush/api/internal/redisclient"
	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/utils"

	_ "github.com/doopush/doopush/api/docs"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// ListenPort API 监听内部端口；外部经 nginx (prod) / Vite (dev) 反代
const ListenPort = 50001

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "启动API服务器",
	Run: func(cmd *cobra.Command, args []string) {
		// 加载配置文件
		envFile, _ := cmd.Flags().GetString("env-file")
		if envFile != "" {
			config.LoadConfig(envFile)
		}

		// 连接数据库
		database.Connect()
		database.AutoMigrate()

		// 启动导出文件清理调度器
		exportService := services.NewExportService()
		exportService.StartCleanupScheduler()

		// 启动服务器
		startServer()
	},
}

func init() {
	rootCmd.AddCommand(serveCmd)
	serveCmd.Flags().StringP("env-file", "e", "", "环境变量文件路径 (可选)")
}

func startServer() {
	// 设置Gin模式
	if config.GetString("APP_ENV", "development") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 创建Gin引擎
	r := gin.Default()
	r.UseRawPath = true
	r.UnescapePathValues = true

	// 全局中间件
	r.Use(middleware.CORS())

	// 静态文件服务
	r.Static("/uploads", "./uploads")

	// Redis 不可用时设备列表回退到 DB 的 is_online，与请求路径的容错策略一致；不阻断启动
	rdb, err := redisclient.New()
	if err != nil {
		log.Printf("Redis 初始化失败，设备在线态将回退到 DB stale 值: %v", err)
	}

	// 控制器
	healthCtrl := controllers.NewHealthController()
	authCtrl := controllers.NewAuthController()
	appCtrl := controllers.NewAppController()
	deviceCtrl := controllers.NewDeviceController(rdb)
	pushCtrl := controllers.NewPushController()
	configCtrl := controllers.NewConfigController()
	templateCtrl := controllers.NewTemplateController()
	tagCtrl := controllers.NewTagController()
	groupCtrl := controllers.NewGroupController()
	schedulerCtrl := controllers.NewSchedulerController()
	auditCtrl := controllers.NewAuditController()
	uploadCtrl := controllers.NewUploadController()
	exportCtrl := controllers.NewExportController()
	callbackCtrl := controllers.NewCallbackController()
	invitationCtrl := controllers.NewInvitationController()

	// 基础路由 (无需认证)
	r.GET("/health", healthCtrl.Check)

	// API路由组
	api := r.Group("/api/v1")
	{
		// 健康检查 (无需认证)
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
		authenticated.Use(middleware.AuditLogger())
		{
			// 用户信息
			authenticated.GET("/auth/profile", authCtrl.Profile)
			authenticated.PUT("/auth/profile", authCtrl.UpdateProfile)
			authenticated.PUT("/auth/password", authCtrl.ChangePassword)
			authenticated.GET("/auth/apps", authCtrl.UserApps)
			authenticated.GET("/inbox", invitationCtrl.GetInbox)
			authenticated.GET("/inbox/unread-count", invitationCtrl.GetUnreadCount)
			authenticated.POST("/inbox/read-all", invitationCtrl.MarkAllRead)
			authenticated.PATCH("/inbox/:invitationId/read", invitationCtrl.MarkRead)
			authenticated.POST("/inbox/:invitationId/accept", invitationCtrl.AcceptInvitation)
			authenticated.POST("/inbox/:invitationId/reject", invitationCtrl.RejectInvitation)

			// 文件上传
			authenticated.POST("/upload/image", uploadCtrl.UploadImage)
			authenticated.DELETE("/upload/delete", uploadCtrl.DeleteUploadedFile)
			authenticated.GET("/upload/files", uploadCtrl.GetUserFiles)

			// 应用管理
			authenticated.POST("/apps", appCtrl.CreateApp)
			authenticated.GET("/apps", appCtrl.GetApps)
			authenticated.GET("/apps/:appId", middleware.RequireAppRole("viewer"), appCtrl.GetApp)
			authenticated.PUT("/apps/:appId", middleware.RequireAppRole("developer"), appCtrl.UpdateApp)
			authenticated.DELETE("/apps/:appId", middleware.RequireAppRole("owner"), appCtrl.DeleteApp)
			authenticated.GET("/apps/:appId/members", middleware.RequireAppRole("owner"), appCtrl.GetAppMembers)
			authenticated.PATCH("/apps/:appId/members/:userId", middleware.RequireAppRole("owner"), appCtrl.UpdateAppMember)
			authenticated.DELETE("/apps/:appId/members/:userId", middleware.RequireAppRole("owner"), appCtrl.RemoveAppMember)
			authenticated.GET("/apps/:appId/invite-candidate", middleware.RequireAppRole("owner"), invitationCtrl.LookupCandidate)
			authenticated.GET("/apps/:appId/invitations", middleware.RequireAppRole("owner"), invitationCtrl.GetPendingInvitations)
			authenticated.POST("/apps/:appId/invitations", middleware.RequireAppRole("owner"), invitationCtrl.CreateInvitation)
			authenticated.DELETE("/apps/:appId/invitations/:invitationId", middleware.RequireAppRole("owner"), invitationCtrl.CancelInvitation)

			// API密钥管理
			authenticated.GET("/apps/:appId/api-keys", middleware.RequireAppRole("developer"), appCtrl.GetAppAPIKeys)
			authenticated.POST("/apps/:appId/api-keys", middleware.RequireAppRole("developer"), appCtrl.CreateAPIKey)
			authenticated.DELETE("/apps/:appId/api-keys/:keyId", middleware.RequireAppRole("developer"), appCtrl.DeleteAPIKey)

			// 设备管理
			authenticated.GET("/apps/:appId/devices", middleware.RequireAppRole("viewer"), deviceCtrl.GetDevices)
			authenticated.GET("/apps/:appId/devices/:deviceId", middleware.RequireAppRole("viewer"), deviceCtrl.GetDevice)
			authenticated.PUT("/apps/:appId/devices/:deviceId/status", middleware.RequireAppRole("developer"), deviceCtrl.UpdateDeviceStatus)
			authenticated.DELETE("/apps/:appId/devices/:deviceId", middleware.RequireAppRole("developer"), deviceCtrl.DeleteDevice)

			// 推送管理 - 查询类接口（仅JWT认证）
			authenticated.GET("/apps/:appId/push/logs", middleware.RequireAppRole("viewer"), pushCtrl.GetPushLogs)
			authenticated.GET("/apps/:appId/push/logs/:logId", middleware.RequireAppRole("viewer"), pushCtrl.GetPushLogDetails)
			authenticated.GET("/apps/:appId/push/statistics", middleware.RequireAppRole("viewer"), pushCtrl.GetPushStatistics)

			// 应用配置管理
			authenticated.GET("/apps/:appId/config", middleware.RequireAppRole("developer"), configCtrl.GetAppConfigs)
			authenticated.POST("/apps/:appId/config", middleware.RequireAppRole("developer"), configCtrl.SetAppConfig)
			authenticated.PUT("/apps/:appId/config/:configId", middleware.RequireAppRole("developer"), configCtrl.UpdateAppConfig)
			authenticated.DELETE("/apps/:appId/config/:configId", middleware.RequireAppRole("developer"), configCtrl.DeleteAppConfig)
			authenticated.POST("/apps/:appId/config/test", middleware.RequireAppRole("developer"), configCtrl.TestAppConfig)

			// 消息模板管理
			authenticated.GET("/apps/:appId/templates", middleware.RequireAppRole("viewer"), templateCtrl.GetTemplates)
			authenticated.POST("/apps/:appId/templates", middleware.RequireAppRole("developer"), templateCtrl.CreateTemplate)
			authenticated.GET("/apps/:appId/templates/:id", middleware.RequireAppRole("viewer"), templateCtrl.GetTemplate)
			authenticated.PUT("/apps/:appId/templates/:id", middleware.RequireAppRole("developer"), templateCtrl.UpdateTemplate)
			authenticated.DELETE("/apps/:appId/templates/:id", middleware.RequireAppRole("developer"), templateCtrl.DeleteTemplate)
			authenticated.POST("/apps/:appId/templates/:id/render", middleware.RequireAppRole("viewer"), templateCtrl.RenderTemplate)

			// 设备标签管理
			authenticated.GET("/apps/:appId/device-tags", middleware.RequireAppRole("viewer"), tagCtrl.ListDeviceTags)
			authenticated.GET("/apps/:appId/device-tags/:deviceToken", middleware.RequireAppRole("viewer"), tagCtrl.GetDeviceTags)
			authenticated.POST("/apps/:appId/device-tags/:deviceToken", middleware.RequireAppRole("developer"), tagCtrl.AddDeviceTag)
			authenticated.DELETE("/apps/:appId/device-tags/:deviceToken/:tagName", middleware.RequireAppRole("developer"), tagCtrl.DeleteDeviceTag)
			authenticated.POST("/apps/:appId/device-tags/batch", middleware.RequireAppRole("developer"), tagCtrl.BatchAddDeviceTags)
			authenticated.GET("/apps/:appId/tags/devices", middleware.RequireAppRole("viewer"), tagCtrl.GetDevicesByTag)
			authenticated.GET("/apps/:appId/tags", middleware.RequireAppRole("viewer"), tagCtrl.GetAppTagStatistics)

			// 设备分组管理
			authenticated.GET("/apps/:appId/device-groups", middleware.RequireAppRole("viewer"), groupCtrl.GetGroups)
			authenticated.POST("/apps/:appId/device-groups", middleware.RequireAppRole("developer"), groupCtrl.CreateGroup)
			authenticated.GET("/apps/:appId/device-groups/:id", middleware.RequireAppRole("viewer"), groupCtrl.GetGroup)
			authenticated.PUT("/apps/:appId/device-groups/:id", middleware.RequireAppRole("developer"), groupCtrl.UpdateGroup)
			authenticated.DELETE("/apps/:appId/device-groups/:id", middleware.RequireAppRole("developer"), groupCtrl.DeleteGroup)

			// 定时推送管理
			authenticated.GET("/apps/:appId/scheduled-pushes", middleware.RequireAppRole("viewer"), schedulerCtrl.GetScheduledPushes)
			authenticated.GET("/apps/:appId/scheduled-pushes/stats", middleware.RequireAppRole("viewer"), schedulerCtrl.GetScheduledPushStats)
			authenticated.POST("/apps/:appId/scheduled-pushes", middleware.RequireAppRole("developer"), schedulerCtrl.CreateScheduledPush)
			authenticated.GET("/apps/:appId/scheduled-pushes/:id", middleware.RequireAppRole("viewer"), schedulerCtrl.GetScheduledPush)
			authenticated.PUT("/apps/:appId/scheduled-pushes/:id", middleware.RequireAppRole("developer"), schedulerCtrl.UpdateScheduledPush)
			authenticated.DELETE("/apps/:appId/scheduled-pushes/:id", middleware.RequireAppRole("developer"), schedulerCtrl.DeleteScheduledPush)
			authenticated.POST("/apps/:appId/scheduled-pushes/:id/pause", middleware.RequireAppRole("developer"), schedulerCtrl.PauseScheduledPush)
			authenticated.POST("/apps/:appId/scheduled-pushes/:id/resume", middleware.RequireAppRole("developer"), schedulerCtrl.ResumeScheduledPush)
			authenticated.POST("/apps/:appId/scheduled-pushes/:id/execute", middleware.RequireAppRole("developer"), schedulerCtrl.ExecuteScheduledPush)

			// 审计日志管理
			authenticated.GET("/apps/:appId/audit-logs", middleware.RequireAppRole("viewer"), auditCtrl.GetAppAuditLogs)
			authenticated.POST("/apps/:appId/export/audit-logs", middleware.RequireAppRole("viewer"), exportCtrl.ExportAppAuditLogs)
			authenticated.GET("/apps/:appId/audit-logs/operation-statistics", middleware.RequireAppRole("viewer"), auditCtrl.GetOperationStatistics)
			authenticated.GET("/apps/:appId/audit-logs/user-activity-statistics", middleware.RequireAppRole("viewer"), auditCtrl.GetUserActivityStatistics)

			// 导出功能
			authenticated.POST("/apps/:appId/export/push-logs", middleware.RequireAppRole("viewer"), exportCtrl.ExportPushLogs)
			authenticated.POST("/apps/:appId/export/push-logs/:logId/details", middleware.RequireAppRole("viewer"), exportCtrl.ExportPushLogDetails)
			authenticated.POST("/apps/:appId/export/push-statistics", middleware.RequireAppRole("viewer"), exportCtrl.ExportPushStatistics)
		}

		// 导出文件下载 (无需认证)
		api.GET("/export/download/:token", exportCtrl.DownloadFile)

		// 消息回执接口 (无需认证，供各厂商推送服务回调使用)
		receipt := api.Group("/apps/callback")
		{
			receipt.POST("/huawei", callbackCtrl.ReceiveHuaweiCallback)
			receipt.POST("/honor", callbackCtrl.ReceiveHonorCallback)
			receipt.POST("/oppo", callbackCtrl.ReceiveOppoCallback)
			receipt.POST("/vivo", callbackCtrl.ReceiveVivoCallback)
			receipt.POST("/xiaomi", callbackCtrl.ReceiveXiaomiCallback)
			receipt.POST("/meizu", callbackCtrl.ReceiveMeizuCallback)
			receipt.POST("", callbackCtrl.ReceiveGenericCallback) // 通用回执接口
		}

		// API Key认证的路由 (供客户端SDK使用)
		apiKeyRoutes := api.Group("")
		apiKeyRoutes.Use(middleware.APIKeyAuth())
		{
			apiKeyRoutes.POST("/apps/:appId/devices", deviceCtrl.RegisterDevice)
			apiKeyRoutes.POST("/apps/:appId/push/statistics/report", pushCtrl.ReportPushStatistics)
		}

		// 双重认证的路由 (支持JWT和API Key认证)
		dualAuthRoutes := api.Group("")
		dualAuthRoutes.Use(middleware.DualAuth())
		dualAuthRoutes.Use(middleware.AuditLogger())
		{
			// 推送管理 - 发送类接口（支持JWT和API Key双重认证）
			dualAuthRoutes.POST("/apps/:appId/push", pushCtrl.SendPush)
			dualAuthRoutes.POST("/apps/:appId/push/single", pushCtrl.SendSingle)
			dualAuthRoutes.POST("/apps/:appId/push/batch", pushCtrl.SendBatch)
			dualAuthRoutes.POST("/apps/:appId/push/broadcast", pushCtrl.SendBroadcast)
		}
	}

	// Swagger文档
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// 启动服务器
	if config.GetString("APP_ENV", "development") == "development" {
		utils.KillProcessByPort(ListenPort)
	}

	addr := ":" + strconv.Itoa(ListenPort)
	log.Printf("服务器启动在 %s", addr)
	log.Printf("Swagger文档: http://localhost%s/swagger/index.html", addr)

	if err := r.Run(addr); err != nil {
		log.Fatal("服务器启动失败:", err)
	}
}
