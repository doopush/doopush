import apiClient from './api-client'

export interface PushLogFilters {
  status?: string
  platform?: string
  search?: string
  start_date?: string
  end_date?: string
}

export interface StatisticsParams {
  time_range?: string
  start_date?: string
  end_date?: string
}

export interface ExportResult {
  download_url: string
  filename: string
  expires_at: string
}

export class ExportService {
  /**
   * 导出推送日志
   */
  static async exportPushLogs(appId: number, filters: PushLogFilters): Promise<ExportResult> {
    return apiClient.post(`/apps/${appId}/export/push-logs`, { filters })
  }

  /**
   * 导出推送统计
   */
  static async exportPushStatistics(appId: number, params: StatisticsParams): Promise<ExportResult> {
    return apiClient.post(`/apps/${appId}/export/push-statistics`, params)
  }

  /**
   * 下载文件
   */
  static downloadFile(downloadUrl: string, filename: string): void {
    // 创建一个临时的 a 标签来触发下载
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    link.style.display = 'none'
    
    // 添加到 DOM 并触发点击
    document.body.appendChild(link)
    link.click()
    
    // 清理
    document.body.removeChild(link)
  }

  /**
   * 通过完整URL下载文件（用于API返回的下载链接）
   */
  static async downloadFromUrl(downloadUrl: string, filename: string): Promise<void> {
    try {
      // 如果是相对路径，需要添加API基础路径
      const fullUrl = downloadUrl.startsWith('/') 
        ? `/api/v1${downloadUrl}` 
        : downloadUrl

      // 使用fetch下载文件
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token') || ''}`,
        },
      })

      if (!response.ok) {
        throw new Error(`下载失败: ${response.statusText}`)
      }

      // 获取文件内容
      const blob = await response.blob()
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.style.display = 'none'
      
      // 触发下载
      document.body.appendChild(link)
      link.click()
      
      // 清理
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('下载文件失败:', error)
      throw error
    }
  }
}