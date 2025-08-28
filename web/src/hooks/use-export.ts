import { useState, useCallback, useRef } from 'react'
import { ExportService, type ExportResult, type PushLogFilters, type StatisticsParams } from '@/services/export-service'

interface UseExportOptions {
  onSuccess?: (result: ExportResult) => void
  onError?: (error: string) => void
}

export function useExport(options: UseExportOptions = {}) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const exportData = useCallback(async (exportFn: () => Promise<ExportResult>) => {
    // 防止重复请求
    if (isExporting) {
      return
    }

    // 清除之前的防抖定时器
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // 设置防抖，防止用户快速点击
    debounceRef.current = setTimeout(async () => {
      setIsExporting(true)
      setError(null)

      try {
        const result = await exportFn()
        
        // 自动触发下载
        await ExportService.downloadFromUrl(result.download_url, result.filename)
        
        // 调用成功回调
        options.onSuccess?.(result)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '导出失败'
        setError(errorMessage)
        options.onError?.(errorMessage)
      } finally {
        setIsExporting(false)
      }
    }, 300) // 300ms 防抖
  }, [isExporting, options])

  const exportPushLogs = useCallback((appId: number, filters: PushLogFilters) => {
    return exportData(() => ExportService.exportPushLogs(appId, filters))
  }, [exportData])

  const exportPushStatistics = useCallback((appId: number, params: StatisticsParams) => {
    return exportData(() => ExportService.exportPushStatistics(appId, params))
  }, [exportData])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // 清理防抖定时器
  const cleanup = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
  }, [])

  return {
    isExporting,
    error,
    exportData,
    exportPushLogs,
    exportPushStatistics,
    clearError,
    cleanup,
  }
}