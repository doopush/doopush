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
    // 统一使用 days=30 作为默认参数
    const defaultParams = { days: 30, ...params }
    return apiClient.get(`/apps/${appId}/push/statistics`, { params: defaultParams })
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

  /**
   * 获取推送分析数据 - 支持传入已有stats数据避免重复请求
   */
  static async getPushAnalytics(appId: number, params?: {
    days?: number
    stats?: Awaited<ReturnType<typeof PushService.getPushStatistics>>
  }): Promise<{
    // 推送效果指标
    effectMetrics: {
      successRate: number
      clickRate: number
      openRate: number
      avgDailyPushes: number
    }
    // 用户活跃度指标
    userActivityMetrics: {
      totalDevices: number
      activeDevices: number
      activityRate: number
      avgResponseTime: number
    }
    // 设备分析指标
    deviceMetrics: {
      platformDistribution: Array<{
        platform: string
        count: number
        percentage: number
        successRate: number
      }>
      vendorDistribution: Array<{
        vendor: string
        count: number
        successRate: number
      }>
    }
    // 时间趋势数据
    trends: {
      dailySuccess: Array<{
        date: string
        success: number
        total: number
        rate: number
      }>
      dailyActivity: Array<{
        date: string
        clicks: number
        opens: number
        devices: number
      }>
    }
  }> {
    // 如果传入了stats数据则直接使用，否则请求新数据
    const stats = params?.stats || await this.getPushStatistics(appId, { days: params?.days })

    // 先处理可能为 null 的数据
    const platformStats = stats.platform_stats || []
    const dailyStats = stats.daily_stats || []

    // 计算推送效果指标
    const successRate = stats.total_pushes > 0 ? (stats.success_pushes / stats.total_pushes) * 100 : 0
    const clickRate = stats.total_pushes > 0 ? (stats.total_clicks / stats.total_pushes) * 100 : 0
    const openRate = stats.total_pushes > 0 ? (stats.total_opens / stats.total_pushes) * 100 : 0
    const avgDailyPushes = dailyStats.length > 0
      ? dailyStats.reduce((sum, day) => sum + day.total_pushes, 0) / dailyStats.length
      : 0

    // 计算用户活跃度指标
    const activeDevices = stats.total_devices // 假设有推送记录的设备都算活跃
    const activityRate = stats.total_devices > 0 ? (activeDevices / stats.total_devices) * 100 : 0

    // 计算设备分析指标
    const totalPlatformPushes = platformStats.reduce((sum, p) => sum + p.total_pushes, 0)
    
    const platformDistribution = platformStats.map(platform => ({
      platform: platform.platform,
      count: platform.total_pushes,
      percentage: totalPlatformPushes > 0 ? (platform.total_pushes / totalPlatformPushes) * 100 : 0,
      successRate: platform.total_pushes > 0 ? (platform.success_pushes / platform.total_pushes) * 100 : 0
    }))

    // 时间趋势数据
    const dailySuccess = dailyStats.map(day => ({
      date: day.date,
      success: day.success_pushes,
      total: day.total_pushes,
      rate: day.total_pushes > 0 ? (day.success_pushes / day.total_pushes) * 100 : 0
    }))

    const dailyActivity = dailyStats.map(day => ({
      date: day.date,
      clicks: day.click_count,
      opens: day.open_count,
      devices: day.total_pushes // 近似表示活跃设备数
    }))

    return {
      effectMetrics: {
        successRate,
        clickRate,
        openRate,
        avgDailyPushes
      },
      userActivityMetrics: {
        totalDevices: stats.total_devices,
        activeDevices,
        activityRate,
        avgResponseTime: 0 // 暂时设为0，后续可以扩展
      },
      deviceMetrics: {
        platformDistribution,
        vendorDistribution: [] // 暂时为空，后续可以扩展厂商分析
      },
      trends: {
        dailySuccess,
        dailyActivity
      }
    }
  }
}
