import { apiClient } from './api-client'
import type { ScheduledPush, PaginationParams, APIResponse, PaginatedResponse } from '@/types/api'

export interface CreateScheduledPushRequest {
  title: string
  content: string
  payload?: string
  scheduled_at: string
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly'
  repeat_config?: string
  timezone?: string
  push_type: 'single' | 'batch' | 'tags' | 'broadcast' | 'groups'
  target_config: string
  template_id?: number
  template_data?: string
}

export interface UpdateScheduledPushRequest {
  title?: string
  content?: string
  payload?: string
  scheduled_at?: string
  repeat_type?: 'none' | 'daily' | 'weekly' | 'monthly'
  repeat_config?: string
  timezone?: string
  push_type?: 'single' | 'batch' | 'tags' | 'broadcast' | 'groups'
  target_config?: string
  template_id?: number
  template_data?: string
  status?: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
}

export class ScheduledPushService {
  static async getScheduledPushes(appId: number, params?: PaginationParams & {
    search?: string
    status?: string
    repeat_type?: string
  }): Promise<PaginatedResponse<ScheduledPush>> {
    return apiClient.get(`/apps/${appId}/scheduled-pushes`, { params })
  }

  static async getScheduledPush(appId: number, id: number): Promise<APIResponse<ScheduledPush>> {
    return apiClient.get(`/apps/${appId}/scheduled-pushes/${id}`)
  }

  static async createScheduledPush(appId: number, data: CreateScheduledPushRequest): Promise<APIResponse<ScheduledPush>> {
    return apiClient.post(`/apps/${appId}/scheduled-pushes`, data)
  }

  static async updateScheduledPush(appId: number, id: number, data: UpdateScheduledPushRequest): Promise<APIResponse<ScheduledPush>> {
    return apiClient.put(`/apps/${appId}/scheduled-pushes/${id}`, data)
  }

  static async deleteScheduledPush(appId: number, id: number): Promise<APIResponse<null>> {
    return apiClient.delete(`/apps/${appId}/scheduled-pushes/${id}`)
  }

  static async pauseScheduledPush(appId: number, id: number): Promise<APIResponse<null>> {
    return apiClient.post(`/apps/${appId}/scheduled-pushes/${id}/pause`)
  }

  static async resumeScheduledPush(appId: number, id: number): Promise<APIResponse<null>> {
    return apiClient.post(`/apps/${appId}/scheduled-pushes/${id}/resume`)
  }

  static async executeScheduledPush(appId: number, id: number): Promise<APIResponse<null>> {
    return apiClient.post(`/apps/${appId}/scheduled-pushes/${id}/execute`)
  }

  static async getScheduledPushStats(appId: number): Promise<{
    total: number
    pending: number
    running: number
    completed: number
    failed: number
    paused: number
  }> {
    return apiClient.get(`/apps/${appId}/scheduled-pushes/stats`)
  }
}
