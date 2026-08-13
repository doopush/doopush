import apiClient from './api-client'
import type { App, AppConfig, AppInvitation, AppInviteCandidate, AppMember, AppRole, PaginationRequest } from '@/types/api'

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

  static async getAppMembers(appId: number): Promise<AppMember[]> {
    return apiClient.get(`/apps/${appId}/members`)
  }

  static async lookupInviteCandidate(appId: number, email: string): Promise<AppInviteCandidate> {
    return apiClient.get(`/apps/${appId}/invite-candidate`, { params: { email } })
  }

  static async getPendingInvitations(appId: number): Promise<AppInvitation[]> {
    return apiClient.get(`/apps/${appId}/invitations`)
  }

  static async createInvitation(appId: number, data: { invitee_id: number; role: AppRole }): Promise<AppInvitation> {
    return apiClient.post(`/apps/${appId}/invitations`, data)
  }

  static async cancelInvitation(appId: number, invitationId: number): Promise<void> {
    return apiClient.delete(`/apps/${appId}/invitations/${invitationId}`)
  }

  static async updateAppMember(appId: number, userId: number, role: AppRole): Promise<AppMember> {
    return apiClient.patch(`/apps/${appId}/members/${userId}`, { role })
  }

  static async removeAppMember(appId: number, userId: number): Promise<void> {
    return apiClient.delete(`/apps/${appId}/members/${userId}`)
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
  static async uploadIcon(file: File, appId: number = -1): Promise<{
    filename: string
    url: string
    size: number
  }> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('appId', appId.toString())
    
    return apiClient.post('/upload/image?type=app_icon', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  /**
   * 删除上传的文件
   */
  static async deleteUploadedFile(url: string, appId: number = -1): Promise<void> {
    return apiClient.delete(`/upload/delete?url=${encodeURIComponent(url)}&appId=${appId}`)
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
