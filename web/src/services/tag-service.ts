import apiClient from './api-client'
import type { TagStatistic, UserTag } from '@/types/api'

export interface AddUserTagRequest {
  tag_name: string
  tag_value: string
}

export class TagService {
  /**
   * 获取应用标签统计
   */
  static async getTagStatistics(appId: number): Promise<TagStatistic[]> {
    return apiClient.get(`/apps/${appId}/tags`)
  }

  /**
   * 获取用户标签
   */
  static async getUserTags(appId: number, userId: string): Promise<UserTag[]> {
    return apiClient.get(`/apps/${appId}/users/${userId}/tags`)
  }

  /**
   * 添加用户标签
   */
  static async addUserTag(appId: number, userId: string, data: AddUserTagRequest): Promise<UserTag> {
    return apiClient.post(`/apps/${appId}/users/${userId}/tags`, data)
  }

  /**
   * 删除用户标签
   */
  static async deleteUserTag(appId: number, userId: string, tagName: string): Promise<void> {
    return apiClient.delete(`/apps/${appId}/users/${userId}/tags/${tagName}`)
  }
}