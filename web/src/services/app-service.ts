import apiClient from './api-client'
import type { App, AppAPIKey, AppConfig, PaginationRequest } from '@/types/api'

export class AppService {
  /**
   * 获取应用列表
   */
  static async getApps(params?: PaginationRequest): Promise<App[]> {
    return apiClient.get('/apps', { params })
  }

  /**
   * 获取应用详情
   */
  static async getApp(appId: number): Promise<App> {
    return apiClient.get(`/apps/${appId}`)
  }

  /**
   * 创建应用
   */
  static async createApp(data: {
    name: string
    package_name: string
    description?: string
    platform: 'ios' | 'android' | 'both'
    app_icon?: string
  }): Promise<App> {
    return apiClient.post('/apps', data)
  }

  /**
   * 更新应用
   */
  static async updateApp(appId: number, data: Partial<{
    name: string
    package_name: string
    description: string
    platform: 'ios' | 'android' | 'both'
    app_icon: string
    status: number
  }>): Promise<App> {
    return apiClient.put(`/apps/${appId}`, data)
  }

  /**
   * 删除应用
   */
  static async deleteApp(appId: number): Promise<void> {
    return apiClient.delete(`/apps/${appId}`)
  }

  /**
   * 获取应用API密钥列表
   */
  static async getAppAPIKeys(appId: number): Promise<AppAPIKey[]> {
    return apiClient.get(`/apps/${appId}/api-keys`)
  }

  /**
   * 创建API密钥
   */
  static async createAPIKey(appId: number, data: {
    name: string
    permissions?: string[]
    expires_days?: number
  }): Promise<{ api_key: string; key_info: AppAPIKey; warning?: string }> {
    return apiClient.post(`/apps/${appId}/api-keys`, data)
  }

  /**
   * 删除API密钥
   */
  static async deleteAPIKey(appId: number, keyId: number): Promise<void> {
    return apiClient.delete(`/apps/${appId}/api-keys/${keyId}`)
  }

  /**
   * 获取应用API密钥列表 (别名)
   */
  static async getAPIKeys(appId: number): Promise<AppAPIKey[]> {
    return this.getAppAPIKeys(appId)
  }

  /**
   * 获取应用配置列表
   */
  static async getAppConfigs(appId: number): Promise<AppConfig[]> {
    return apiClient.get(`/apps/${appId}/config`)
  }

  /**
   * 设置应用配置
   */
  static async setAppConfig(appId: number, data: {
    platform: 'ios' | 'android'
    channel: string
    config: string
  }): Promise<AppConfig> {
    return apiClient.post(`/apps/${appId}/config`, data)
  }



  /**
   * 上传图标
   */
  static async uploadIcon(file: File): Promise<{
    filename: string
    url: string
    size: number
  }> {
    const formData = new FormData()
    formData.append('file', file)
    
    return apiClient.post('/upload/image?type=app_icon', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  /**
   * 删除上传的文件
   */
  static async deleteUploadedFile(url: string): Promise<void> {
    return apiClient.delete(`/upload/delete?url=${encodeURIComponent(url)}`)
  }

  /**
   * 获取用户上传文件列表（支持分页）
   */
  static async getUserFiles(params?: {
    type?: 'app_icon' | 'avatar'
    page?: number
    limit?: number
  }): Promise<import('@/types/api').UserFilesResponse> {
    const searchParams = new URLSearchParams()
    if (params?.type) searchParams.append('type', params.type)
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    
    const query = searchParams.toString()
    return apiClient.get(`/upload/files${query ? `?${query}` : ''}`)
  }
}
