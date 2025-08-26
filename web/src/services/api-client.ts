import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth-store'

// 创建 Axios 实例
export const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 添加认证头
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 优先使用请求中已设置的Authorization头
    if (!config.headers.Authorization) {
      const token = useAuthStore.getState().token
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 处理错误和认证
apiClient.interceptors.response.use(
  (response) => {
    // 统一的成功响应处理 - 提取data字段
    const responseData = response.data
    if (responseData && typeof responseData === 'object' && 'data' in responseData) {
      return responseData.data
    }
    return responseData
  },
  (error: AxiosError) => {
    // 统一的错误处理
    if (error.response) {
      const status = error.response.status
      const data = error.response.data as {
        code?: number | string
        message?: string
        data?: unknown
      }
      
      switch (status) {
        case 401:
          // 未认证 - 跳转到登录页
          if (window.location.pathname !== '/sign-in' && window.location.pathname !== '/sign-up') {
            window.location.href = '/sign-in?handle=logout'
          }
          break
          
        case 403:
          // 无权限
          console.error('权限不足:', data?.message || '访问被拒绝')
          break
          
        case 422:
          // 验证错误
          console.error('验证失败:', data?.message || '数据验证失败')
          break
          
        case 500:
          // 服务器错误
          console.error('服务器错误:', data?.message || '服务器内部错误')
          break
          
        default:
          console.error('请求错误:', data?.message || `HTTP ${status}`)
      }
      
      // 返回标准化的错误格式
      return Promise.reject({
        code: data?.code || status,
        message: data?.message || `HTTP ${status} 错误`,
        data: data?.data,
      })
    }
    
    // 网络错误或超时
    if (error.code === 'ECONNABORTED') {
      return Promise.reject({
        code: 'TIMEOUT',
        message: '请求超时，请检查网络连接',
      })
    }
    
    return Promise.reject({
      code: 'NETWORK_ERROR',
      message: '网络连接失败，请稍后重试',
    })
  }
)

// API 响应类型定义
export interface APIResponse<T = unknown> {
  code: number
  message: string
  data?: T
}

// 分页响应类型
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export default apiClient
