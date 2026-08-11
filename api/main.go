package main

import (
	"github.com/doopush/doopush/api/cmd"
)

// @title DooPush Platform API
// @version 1.0
// @description 企业级推送平台API服务
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @securityDefinitions.apikey AppKeyAuth
// @in header
// @name X-App-Key
func main() {
	cmd.Execute()
}
