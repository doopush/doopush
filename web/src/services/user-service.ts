import { apiClient } from './api-client'
import type { User, PaginationRequest, App, APIResponse } from '@/types/api'
import type { PaginatedResponse } from '@/services/api-client'

export interface CreateUserRequest {
  username: string
  email: string
  password: string
  role: 'admin' | 'user'
}

export interface UpdateUserRequest {
  username?: string
  email?: string
  role?: 'admin' | 'user'
  status?: number  // 1=正常, 0=禁用
}

export interface UserAppPermissionRequest {
  app_id: number
  permission: 'owner' | 'developer' | 'viewer'
}

export interface ChangePasswordRequest {
  old_password: string
  new_password: string
}

export class UserService {
  static async getUsers(params?: PaginationRequest & { 
    search?: string
    role?: string
    status?: string 
  }): Promise<PaginatedResponse<User>> {
    return apiClient.get('/api/v1/users', { params })
  }

  static async getUser(id: number): Promise<APIResponse<User>> {
    return apiClient.get(`/api/v1/users/${id}`)
  }

  static async createUser(data: CreateUserRequest): Promise<APIResponse<User>> {
    return apiClient.post('/api/v1/users', data)
  }

  static async updateUser(id: number, data: UpdateUserRequest): Promise<APIResponse<User>> {
    return apiClient.put(`/api/v1/users/${id}`, data)
  }

  static async deleteUser(id: number): Promise<APIResponse<null>> {
    return apiClient.delete(`/api/v1/users/${id}`)
  }

  static async getUserApps(userId: number): Promise<APIResponse<(App & { permission: string })[]>> {
    return apiClient.get(`/api/v1/users/${userId}/apps`)
  }

  static async setUserAppPermission(userId: number, data: UserAppPermissionRequest): Promise<APIResponse<null>> {
    return apiClient.post(`/api/v1/users/${userId}/apps`, data)
  }

  static async removeUserAppPermission(userId: number, appId: number): Promise<APIResponse<null>> {
    return apiClient.delete(`/api/v1/users/${userId}/apps/${appId}`)
  }

  static async changePassword(userId: number, data: ChangePasswordRequest): Promise<APIResponse<null>> {
    return apiClient.put(`/api/v1/users/${userId}/password`, data)
  }

  static async resetPassword(userId: number): Promise<APIResponse<{ temporary_password: string }>> {
    return apiClient.post(`/api/v1/users/${userId}/reset-password`)
  }
}
