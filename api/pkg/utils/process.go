package utils

import (
	"fmt"
	"net"
	"os/exec"
	"runtime"
	"strconv"
	"time"
)

// KillProcessByPort 根据端口杀死进程，静默版本
func KillProcessByPort(port int) error {
	// 最多重试2次
	for attempt := 1; attempt <= 2; attempt++ {
		// 杀死占用端口的进程
		if err := killProcessByPortCmd(port); err != nil {
			if attempt == 2 {
				return fmt.Errorf("无法释放端口 %d: %v", port, err)
			}
			time.Sleep(time.Second)
			continue
		}

		// 等待端口释放，最多3秒
		if waitForPortFree(port, 3*time.Second) {
			return nil // 成功时静默返回
		}

		if attempt < 2 {
			time.Sleep(time.Second)
		}
	}

	return fmt.Errorf("端口 %d 无法释放", port)
}

// killProcessByPortCmd 使用系统命令杀死占用端口的进程
func killProcessByPortCmd(port int) error {
	switch runtime.GOOS {
	case "darwin", "linux":
		// macOS 和 Linux: 使用 lsof + kill
		return killProcessUnix(port)
	case "windows":
		// Windows: 使用 netstat + taskkill
		return killProcessWindows(port)
	default:
		return fmt.Errorf("不支持的操作系统: %s", runtime.GOOS)
	}
}

// killProcessUnix Unix系统(macOS/Linux)的端口进程清理
func killProcessUnix(port int) error {
	portStr := strconv.Itoa(port)

	// 直接使用 lsof + kill 命令
	cmd := exec.Command("sh", "-c", fmt.Sprintf("lsof -ti:%s | xargs kill -9 2>/dev/null || true", portStr))
	cmd.Run() // 忽略错误，因为可能没有进程占用端口

	return nil
}

// killProcessWindows Windows系统的端口进程清理
func killProcessWindows(port int) error {
	portStr := ":" + strconv.Itoa(port)

	// 查找并杀死占用端口的进程
	cmd := exec.Command("cmd", "/c", fmt.Sprintf(
		`for /f "tokens=5" %%a in ('netstat -ano ^| findstr %s') do taskkill /F /PID %%a 2>nul`,
		portStr))
	cmd.Run() // 忽略错误

	return nil
}

// waitForPortFree 等待端口可用
func waitForPortFree(port int, timeout time.Duration) bool {
	start := time.Now()
	checkInterval := 100 * time.Millisecond

	for time.Since(start) < timeout {
		if isPortActuallyFree(port) {
			return true
		}
		time.Sleep(checkInterval)
	}

	return false
}

// isPortActuallyFree 通过实际尝试绑定端口来检查端口是否可用
func isPortActuallyFree(port int) bool {
	// 尝试监听 TCP 端口
	address := fmt.Sprintf(":%d", port)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return false // 端口不可用
	}

	// 立即关闭监听器
	listener.Close()
	return true // 端口可用
}
