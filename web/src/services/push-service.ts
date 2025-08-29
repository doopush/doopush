import apiClient from './api-client'
import type { 
  PushLog, 
  SendPushRequest, 
  PaginationRequest,
  PaginationEnvelope,
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
    badge?: number
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
    badge?: number
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
    badge?: number
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
   * 标签推送
   */
  static async sendByTags(appId: number, data: {
    title: string
    content: string
    badge?: number
    payload?: {
      action?: string
      url?: string
      data?: string
    }
    target: {
      type: 'tags'
      tags: Array<{
        tag_name: string
        tag_value?: string
      }>
      platform?: string
      channel?: string
    }
  }): Promise<PushLog[]> {
    return apiClient.post(`/apps/${appId}/push`, data)
  }

  /**
   * 获取推送日志（统一分页响应）
   */
  static async getPushLogs(appId: number, params?: PaginationRequest<{ status?: string; platform?: string; start_time?: string; end_time?: string }>): Promise<PaginationEnvelope<PushLog>> {
    return apiClient.get(`/apps/${appId}/push/logs`, { params })
  }

  /**
   * 获取推送统计
   */
  static async getPushStatistics(appId: number, params?: {
    days?: number
  }): Promise<{
    total_pushes: number
    success_pushes: number
    failed_pushes: number
    total_devices: number
    total_clicks: number
    total_opens: number
    daily_stats: Array<{
      date: string
      total_pushes: number
      success_pushes: number
      failed_pushes: number
      click_count: number
      open_count: number
    }>
    platform_stats: Array<{
      platform: string
      total_pushes: number
      success_pushes: number
      failed_pushes: number
    }>
  }> {
    return apiClient.get(`/apps/${appId}/push/statistics`, { params })
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
