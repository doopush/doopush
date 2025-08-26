import apiClient from './api-client'
import type { DeviceGroup, Device } from '@/types/api'

export interface FilterRule {
  field: string
  operator: 'equals' | 'contains' | 'in' | 'not_in' | 'is_null' | 'is_not_null'
  value: {
    string_value?: string
    string_values?: string[]
  }
}

export interface CreateGroupRequest {
  name: string
  description?: string
  filter_rules: FilterRule[]
}

export interface UpdateGroupRequest {
  name: string
  description?: string
  filter_rules: FilterRule[]
  is_active: boolean
}

export interface GroupsResponse {
  groups: DeviceGroup[]
  total: number
  page: number
  page_size: number
}

export interface GroupDetailsResponse {
  group: DeviceGroup
  devices: Device[]
  total: number
  page: number
  page_size: number
}

export class GroupService {
  /**
   * 获取设备分组列表
   */
  static async getGroups(appId: number, page = 1, pageSize = 20): Promise<GroupsResponse> {
    return apiClient.get(`/apps/${appId}/device-groups`, {
      params: { page, page_size: pageSize }
    })
  }

  /**
   * 获取分组详情
   */
  static async getGroup(appId: number, groupId: number, page = 1, pageSize = 20): Promise<GroupDetailsResponse> {
    return apiClient.get(`/apps/${appId}/device-groups/${groupId}`, {
      params: { page, page_size: pageSize }
    })
  }

  /**
   * 创建设备分组
   */
  static async createGroup(appId: number, data: CreateGroupRequest): Promise<DeviceGroup> {
    return apiClient.post(`/apps/${appId}/device-groups`, data)
  }

  /**
   * 更新设备分组
   */
  static async updateGroup(appId: number, groupId: number, data: UpdateGroupRequest): Promise<DeviceGroup> {
    return apiClient.put(`/apps/${appId}/device-groups/${groupId}`, data)
  }

  /**
   * 删除设备分组
   */
  static async deleteGroup(appId: number, groupId: number): Promise<void> {
    return apiClient.delete(`/apps/${appId}/device-groups/${groupId}`)
  }
}
