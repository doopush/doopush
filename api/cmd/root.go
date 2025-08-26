package cmd

import (
	"log"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "doopush",
	Short: "企业级推送平台服务",
	Long:  "支持 iOS APNs 和多 Android 厂商通道的推送平台",
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		log.Fatal(err)
	}
}
