import apiClient from './api-client'
import type { AppConfig } from '@/types/api'

export class ConfigService {
  /**
   * 获取应用配置
   */
  static async getConfigs(appId: number): Promise<AppConfig[]> {
    return apiClient.get(`/apps/${appId}/config`)
  }

  /**
   * 设置应用配置
   */
  static async setConfig(appId: number, data: {
    platform: 'ios' | 'android'
    channel: string
    config: string
  }): Promise<AppConfig> {
    return apiClient.post(`/apps/${appId}/config`, data)
  }

  /**
   * 更新应用配置
   */
  static async updateConfig(appId: number, configId: number, data: {
    config: string
  }): Promise<AppConfig> {
    return apiClient.put(`/apps/${appId}/config/${configId}`, data)
  }

  /**
   * 删除应用配置
   */
  static async deleteConfig(appId: number, configId: number): Promise<void> {
    return apiClient.delete(`/apps/${appId}/config/${configId}`)
  }

  /**
   * 测试推送配置
   */
  static async testConfig(appId: number, data: {
    platform: 'ios' | 'android'
    channel: string
    device_id: string
    test_title?: string
    test_content?: string
  }): Promise<{
    success: boolean
    message: string
    platform: string
    channel: string
    test_device: string
    config_id?: number
    test_time: string
  }> {
    return apiClient.post(`/apps/${appId}/config/test`, data)
  }
}
