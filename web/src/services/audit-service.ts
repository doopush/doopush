import apiClient from './api-client'
import type { AuditLog } from '@/types/api'

export interface AuditLogFilters {
  user_id?: number
  action?: string
  resource?: string
  start_time?: string
  end_time?: string
  page?: number
  page_size?: number
}

export interface AuditLogsResponse {
  logs: AuditLog[]
  total: number
  page: number
  page_size: number
}

export interface ActionStatistic {
  action: string
  count: number
  date: string
}

export class AuditService {
  /**
   * 获取全局审计日志
   */
  static async getGlobalAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogsResponse> {
    return apiClient.get('/audit-logs', { params: filters })
  }

  /**
   * 获取应用审计日志
   */
  static async getAppAuditLogs(appId: number, filters: AuditLogFilters = {}): Promise<AuditLogsResponse> {
    return apiClient.get(`/apps/${appId}/audit-logs`, { params: filters })
  }

  /**
   * 获取操作统计
   */
  static async getActionStatistics(appId?: number, days = 30): Promise<ActionStatistic[]> {
    const params = { days, ...(appId && { app_id: appId }) }
    return apiClient.get('/audit-logs/statistics', { params })
  }
}
