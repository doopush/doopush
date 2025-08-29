import apiClient from './api-client'
import type { TagStatistic, TagStatisticsResponse, DeviceTag } from '@/types/api'

export interface AddDeviceTagRequest {
  tag_name: string
  tag_value: string
}

export class TagService {
  /**
   * 获取应用标签统计
   */
  static async getTagStatistics(appId: number, page = 1, limit = 20, search = ''): Promise<TagStatisticsResponse> {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (search) {
      params.append('search', search)
    }
    return apiClient.get(`/apps/${appId}/tags?${params.toString()}`)
  }

  /**
   * 获取应用标签统计（简化版，返回标签数组）
   */
  static async getTagStatisticsSimple(appId: number, search = '', limit = 50): Promise<TagStatistic[]> {
    const response = await this.getTagStatistics(appId, 1, limit, search)
    return response.data
  }

  /**
   * 获取设备标签
   */
  static async getDeviceTags(appId: number, deviceToken: string): Promise<DeviceTag[]> {
    return apiClient.get(`/apps/${appId}/device-tags/${deviceToken}`)
  }

  /**
   * 添加设备标签
   */
  static async addDeviceTag(appId: number, deviceToken: string, data: AddDeviceTagRequest): Promise<DeviceTag> {
    return apiClient.post(`/apps/${appId}/device-tags/${deviceToken}`, data)
  }

  /**
   * 删除设备标签
   */
  static async deleteDeviceTag(appId: number, deviceToken: string, tagName: string): Promise<void> {
    return apiClient.delete(`/apps/${appId}/device-tags/${deviceToken}/${tagName}`)
  }

  /**
   * 批量添加设备标签
   */
  static async batchAddDeviceTags(appId: number, tags: { device_token: string; tag_name: string; tag_value: string }[]): Promise<void> {
    return apiClient.post(`/apps/${appId}/device-tags/batch`, { tags })
  }

  /**
   * 根据标签获取设备列表
   */
  static async getDevicesByTag(appId: number, tagName: string, tagValue?: string): Promise<string[]> {
    const params = new URLSearchParams({ tag_name: tagName })
    if (tagValue) {
      params.append('tag_value', tagValue)
    }
    return apiClient.get(`/apps/${appId}/tags/devices?${params.toString()}`)
  }
}