import apiClient from './api-client'
import type { 
  PushLog, 
 
  SendPushRequest, 
  PaginationParams,
  PushResult,
} from '@/types/api'

export class PushService {
  /**
   * 发送推送 (通用接口)
   */
  static async sendPush(appId: number, data: SendPushRequest): Promise<PushLog[]> {
    return apiClient.post(`/apps/${appId}/push`, data)
  }

  /**
   * 单设备推送
   */
  static async sendSingle(appId: number, data: {
    device_id: string
    title: string
    content: string
    payload?: {
      action?: string
      url?: string
      data?: string
    }
  }): Promise<PushLog[]> {
    return apiClient.post(`/apps/${appId}/push/single`, data)
  }

  /**
   * 批量推送
   */
  static async sendBatch(appId: number, data: {
    device_ids: string[]
    title: string
    content: string
    payload?: {
      action?: string
      url?: string
      data?: string
    }
  }): Promise<PushLog[]> {
    return apiClient.post(`/apps/${appId}/push/batch`, data)
  }

  /**
   * 广播推送
   */
  static async sendBroadcast(appId: number, data: {
    title: string
    content: string
    payload?: {
      action?: string
      url?: string
      data?: string
    }
    platform?: string
    vendor?: string
  }): Promise<PushLog[]> {
    return apiClient.post(`/apps/${appId}/push/broadcast`, data)
  }

  /**
   * 获取推送日志
   */
  static async getPushLogs(appId: number, params?: PaginationParams & {
    status?: string
    platform?: string
    start_time?: string
    end_time?: string
  }): Promise<{
    logs: PushLog[]
    total: number
    page: number
    page_size: number
  }> {
    return apiClient.get(`/apps/${appId}/push/logs`, { params })
  }

  /**
   * 获取推送统计
   */
  static async getPushStatistics(appId: number): Promise<{
    total_pushes: number
    success_pushes: number
    failed_pushes: number
    total_devices: number
  }> {
    return apiClient.get(`/apps/${appId}/push/statistics`)
  }

  /**
   * 获取推送日志详情
   */
  static async getPushLogDetails(appId: number, logId: number): Promise<{
    log: PushLog
    results: PushResult[]
    stats: {
      total_devices: number
      success_count: number
      failed_count: number
    }
  }> {
    return apiClient.get(`/apps/${appId}/push/logs/${logId}`)
  }
}
