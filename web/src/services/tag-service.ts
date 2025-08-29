import apiClient from './api-client'
import type { TagStatistic, DeviceTag, PaginationEnvelope, PaginationRequest } from '@/types/api'

export interface AddDeviceTagRequest {
  tag_name: string
  tag_value: string
}

export class TagService {
  /**
   * 获取应用标签统计（统一分页）
   */
  static async getTagStatistics(appId: number, params?: PaginationRequest<{ search?: string }>): Promise<PaginationEnvelope<TagStatistic>> {
    return apiClient.get(`/apps/${appId}/tags`, { params })
  }

  /**
   * 获取应用标签统计（简化版，返回标签数组）
   */
  static async getTagStatisticsSimple(appId: number, search = '', page_size = 50): Promise<TagStatistic[]> {
    const response = await this.getTagStatistics(appId, { page: 1, page_size, filters: { search } })
    return response.data.items
  }

  /**
   * 获取设备标签（分页，管理用）
   */
  static async getDeviceTagsPaged(appId: number, params?: PaginationRequest<{ device_token?: string; tag_name?: string; tag_value?: string; search?: string }>): Promise<PaginationEnvelope<DeviceTag>> {
    return apiClient.get(`/apps/${appId}/device-tags`, { params })
  }

  /**
   * 获取某个设备的所有标签（明细）
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