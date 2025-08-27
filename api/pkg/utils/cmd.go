package utils

import (
	"fmt"
	"runtime"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/process"
)

// KillProcessByPort 根据端口杀死进程，使用 gopsutil 库实现跨平台支持
func KillProcessByPort(port int) error {
	// 获取所有网络连接
	connections, err := net.Connections("inet")
	if err != nil {
		return fmt.Errorf("failed to get network connections: %v", err)
	}

	var targetPIDs []int32

	// 查找占用指定端口的进程
	for _, conn := range connections {
		if conn.Laddr.Port == uint32(port) && conn.Status == "LISTEN" {
			if conn.Pid > 0 {
				targetPIDs = append(targetPIDs, conn.Pid)
			}
		}
	}

	if len(targetPIDs) == 0 {
		// 没有找到占用端口的进程，可能端口未被占用
		return nil
	}

	// 去重处理
	pidMap := make(map[int32]bool)
	for _, pid := range targetPIDs {
		pidMap[pid] = true
	}

	// 终止进程
	for pid := range pidMap {
		if err := killProcess(pid); err != nil {
			return fmt.Errorf("failed to kill process %d: %v", pid, err)
		}
	}

	// 等待1秒，确保进程完全终止
	if len(pidMap) > 0 {
		time.Sleep(1000 * time.Millisecond)
	}

	return nil
}

// killProcess 终止指定PID的进程，根据操作系统选择合适的方法
func killProcess(pid int32) error {
	proc, err := process.NewProcess(pid)
	if err != nil {
		return fmt.Errorf("failed to get process %d: %v", pid, err)
	}

	// 检查进程是否存在
	exists, err := proc.IsRunning()
	if err != nil {
		return fmt.Errorf("failed to check if process %d is running: %v", pid, err)
	}
	if !exists {
		return nil // 进程已经不存在了
	}

	// 根据操作系统选择终止方法
	switch runtime.GOOS {
	case "windows":
		// Windows: 使用 Terminate() 方法
		err = proc.Terminate()
	default:
		// Unix-like 系统: 发送 SIGKILL 信号
		err = proc.SendSignal(syscall.SIGKILL)
	}

	if err != nil {
		return fmt.Errorf("failed to terminate process %d: %v", pid, err)
	}

	return nil
}
