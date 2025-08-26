import apiClient from './api-client'
import type { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  UpdateProfileRequest,
  ChangePasswordRequest,
  User, 
  App 
} from '@/types/api'

export class AuthService {
  /**
   * 用户注册
   */
  static async register(data: RegisterRequest): Promise<User> {
    return apiClient.post('/auth/register', data)
  }

  /**
   * 用户登录
   */
  static async login(data: LoginRequest): Promise<LoginResponse> {
    return apiClient.post('/auth/login', data)
  }

  /**
   * 获取当前用户信息
   */
  static async getProfile(): Promise<User> {
    return apiClient.get('/auth/profile')
  }

  /**
   * 获取用户的应用列表
   */
  static async getUserApps(token?: string): Promise<App[]> {
    const config = token ? {
      headers: { Authorization: `Bearer ${token}` }
    } : {}
    return apiClient.get('/auth/apps', config)
  }

  /**
   * 更新用户信息
   */
  static async updateProfile(data: UpdateProfileRequest): Promise<User> {
    return apiClient.put('/auth/profile', data)
  }

  /**
   * 修改密码
   */
  static async changePassword(data: ChangePasswordRequest): Promise<void> {
    return apiClient.put('/auth/password', data)
  }

  /**
   * 上传头像
   */
  static async uploadAvatar(file: File): Promise<{
    filename: string
    url: string
    size: number
  }> {
    const formData = new FormData()
    formData.append('file', file)
    
    return apiClient.post('/upload/image?type=avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  /**
   * 删除上传的头像文件
   */
  static async deleteUploadedAvatar(url: string): Promise<void> {
    return apiClient.delete(`/upload/delete?url=${encodeURIComponent(url)}`)
  }

  /**
   * 登出 (客户端清理)
   * 注意：这个方法应该从 auth store 中调用，而不是直接调用
   */
  static logout(): void {
    // 这个方法保留，但实际清理逻辑在 auth store 中实现
    // 避免循环依赖，调用者应该直接使用 useAuthStore.getState().logout()
  }
}
