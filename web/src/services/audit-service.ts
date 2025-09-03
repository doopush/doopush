import apiClient from './api-client'
import type { 
  AuditLogDTO, 
  AuditFilters, 
  AuditLogListResponse, 
  OperationStat, 
  UserActivityStat 
} from '@/types/api'

// 扩展筛选参数，包含分页信息
export interface AuditLogQueryParams extends AuditFilters {
  page?: number
  page_size?: number
}

export class AuditService {
  /**
   * 获取应用审计日志（增强版）
   */
  static async getAppAuditLogs(appId: number, params: AuditLogQueryParams = {}): Promise<AuditLogListResponse> {
    return apiClient.get(`/apps/${appId}/audit-logs`, { params })
  }

  /**
   * 获取应用操作统计
   */
  static async getAppOperationStatistics(appId: number, params: {
    start_time?: string
    end_time?: string
    limit?: number
  } = {}): Promise<OperationStat[]> {
    const data = await apiClient.get(`/apps/${appId}/audit-logs/operation-statistics`, { params })
    if (Array.isArray(data)) return data as OperationStat[]
    const stats = (data as { statistics?: OperationStat[] })?.statistics
    return Array.isArray(stats) ? stats : []
  }

  /**
   * 获取应用用户活动统计
   */
  static async getAppUserActivityStatistics(appId: number, params: {
    start_time?: string
    end_time?: string
    limit?: number
  } = {}): Promise<UserActivityStat[]> {
    const data = await apiClient.get(`/apps/${appId}/audit-logs/user-activity-statistics`, { params })
    if (Array.isArray(data)) return data as UserActivityStat[]
    const arr = (data as { user_activity?: UserActivityStat[] })?.user_activity
    return Array.isArray(arr) ? arr : []
  }

  /**
   * 导出应用审计日志（Excel格式）
   */
  static async exportAppAuditLogs(appId: number, filters: AuditFilters = {}): Promise<{ download_url: string; filename: string; expires_at: string }> {
    return apiClient.post(`/apps/${appId}/export/audit-logs`, { filters })
  }

  /**
   * 下载导出文件
   */
  static async downloadExportFile(downloadUrl: string, filename: string): Promise<void> {
    // 使用原生axios避免响应拦截器处理blob数据
    const axios = (await import('axios')).default
    const { useAuthStore } = await import('@/stores/auth-store')
    const token = useAuthStore.getState().token
    
    const response = await axios.get(downloadUrl, {
      responseType: 'blob',
      timeout: 60000, // 导出文件可能较大，增加超时时间
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    })

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    
    // 清理
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  /**
   * 获取审计日志详情（包含变更前后数据）
   */
  static async getAuditLogDetails(logId: number): Promise<AuditLogDTO> {
    return apiClient.get(`/audit-logs/${logId}`)
  }

  /**
   * 搜索审计日志（模糊搜索）
   */
  static async searchAuditLogs(params: {
    keyword?: string
    app_id: number
    page?: number
    page_size?: number
  }): Promise<AuditLogListResponse> {
    const { app_id, ...rest } = params
    return apiClient.get(`/apps/${app_id}/audit-logs/search`, { params: rest })
  }
}
