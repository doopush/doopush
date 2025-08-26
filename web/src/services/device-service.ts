import apiClient from './api-client'
import type { Device, DeviceGroup, FilterRule, PaginationParams } from '@/types/api'

export class DeviceService {
  /**
   * 获取设备列表
   */
  static async getDevices(appId: number, params?: PaginationParams & {
    platform?: string
    status?: number
    search?: string
  }): Promise<{
    devices: Device[]
    total: number
    page: number
    size: number
  }> {
    return apiClient.get(`/apps/${appId}/devices`, { params })
  }

  /**
   * 获取设备详情
   */
  static async getDevice(appId: number, deviceToken: string): Promise<Device> {
    return apiClient.get(`/apps/${appId}/devices/${deviceToken}`)
  }

  /**
   * 更新设备状态
   */
  static async updateDeviceStatus(appId: number, deviceToken: string, status: number): Promise<Device> {
    return apiClient.put(`/apps/${appId}/devices/${deviceToken}/status`, { status })
  }

  /**
   * 删除设备
   */
  static async deleteDevice(appId: number, deviceToken: string): Promise<void> {
    return apiClient.delete(`/apps/${appId}/devices/${deviceToken}`)
  }

  /**
   * 注册设备 (API Key 认证)
   */
  static async registerDevice(appId: number, data: {
    device_id: string
    user_id: string
    platform: 'ios' | 'android'
    vendor: string
    device_token: string
    app_version?: string
    system_version?: string
    device_model?: string
    language?: string
    timezone?: string
  }, apiKey: string): Promise<{
    device: Device
    gateway: {
      host: string
      port: number
      ssl: boolean
    }
  }> {
    return apiClient.post(`/apps/${appId}/devices`, data, {
      headers: {
        'X-API-Key': apiKey
      }
    })
  }

  // ===== 设备分组管理 =====

  /**
   * 获取设备分组列表
   */
  static async getDeviceGroups(appId: number, params?: PaginationParams): Promise<{
    groups: DeviceGroup[]
    total: number
    page: number
    size: number
  }> {
    return apiClient.get(`/apps/${appId}/device-groups`, { params })
  }

  /**
   * 获取分组详情和设备列表
   */
  static async getDeviceGroup(appId: number, groupId: number, params?: PaginationParams): Promise<{
    group: DeviceGroup
    devices: Device[]
    total: number
    page: number
    size: number
  }> {
    return apiClient.get(`/apps/${appId}/device-groups/${groupId}`, { params })
  }

  /**
   * 创建设备分组
   */
  static async createDeviceGroup(appId: number, data: {
    name: string
    description?: string
    filter_rules: FilterRule[]
  }): Promise<DeviceGroup> {
    return apiClient.post(`/apps/${appId}/device-groups`, data)
  }

  /**
   * 更新设备分组
   */
  static async updateDeviceGroup(appId: number, groupId: number, data: {
    name: string
    description?: string
    filter_rules: FilterRule[]
    is_active: boolean
  }): Promise<DeviceGroup> {
    return apiClient.put(`/apps/${appId}/device-groups/${groupId}`, data)
  }

  /**
   * 删除设备分组
   */
  static async deleteDeviceGroup(appId: number, groupId: number): Promise<void> {
    return apiClient.delete(`/apps/${appId}/device-groups/${groupId}`)
  }
}
