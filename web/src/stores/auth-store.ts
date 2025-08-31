import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'
import type { User, App } from '@/types/api'

const ACCESS_TOKEN = 'doopush_token'
const CURRENT_APP = 'doopush_current_app'
const CACHED_USER = 'doopush_user'

interface AuthState {
  // 认证状态
  user: User | null
  token: string
  isAuthenticated: boolean
  
  // 应用上下文
  currentApp: App | null
  userApps: App[]
  appsLoading: boolean
  
  // 认证操作
  setAuth: (user: User, token: string) => void
  setUser: (user: User | null) => void
  setToken: (token: string) => void
  logout: () => void
  
  // 应用操作
  setCurrentApp: (app: App | null) => void
  setUserApps: (apps: App[]) => void
  setAppsLoading: (loading: boolean) => void
  
  // 权限检查
  hasAppPermission: (appId: number, permission?: 'owner' | 'developer' | 'viewer') => boolean
}

export const useAuthStore = create<AuthState>()((set, get) => {
  // 初始化状态
  const initToken = getCookie(ACCESS_TOKEN) || ''
  const initAppData = getCookie(CURRENT_APP)
  const initApp = initAppData ? JSON.parse(initAppData) : null
  const initUserData = getCookie(CACHED_USER)
  const initUser = initUserData ? JSON.parse(initUserData) : null

  return {
    // 认证状态
    user: initUser,
    token: initToken,
    isAuthenticated: Boolean(initToken),
    
    // 应用上下文
    currentApp: initApp,
    userApps: [],
    appsLoading: false,
    
    // 认证操作
    setAuth: (user: User, token: string) =>
      set(() => {
        setCookie(ACCESS_TOKEN, token)
        setCookie(CACHED_USER, JSON.stringify(user))
        return {
          user,
          token,
          isAuthenticated: true,
        }
      }),
      
    setUser: (user: User | null) =>
      set(() => {
        if (user) {
          setCookie(CACHED_USER, JSON.stringify(user))
        } else {
          removeCookie(CACHED_USER)
        }
        return { user }
      }),
      
    setToken: (token: string) =>
      set(() => {
        setCookie(ACCESS_TOKEN, token)
        return { token, isAuthenticated: Boolean(token) }
      }),
      
    logout: () =>
      set(() => {
        removeCookie(ACCESS_TOKEN)
        removeCookie(CACHED_USER)
        return {
          user: null,
          token: '',
          isAuthenticated: false,
          currentApp: null,
          userApps: [],
        }
      }),
    
    // 应用操作
    setCurrentApp: (app: App | null) =>
      set(() => {
        if (app) {
          setCookie(CURRENT_APP, JSON.stringify(app))
        } else {
          removeCookie(CURRENT_APP)
        }
        return { currentApp: app }
      }),
      
    setUserApps: (apps: App[]) =>
      set(() => {
        // 检查之前保存的应用是否仍然有效
        const savedAppData = getCookie(CURRENT_APP)
        let validCurrentApp = null

        if (savedAppData) {
          try {
            const savedApp = JSON.parse(savedAppData)
            // 检查保存的应用是否在新的应用列表中
            const appExists = apps.some(app => app.id === savedApp.id)
            if (appExists) {
              // 如果存在，设置为当前应用
              validCurrentApp = savedApp
            } else {
              // 如果不存在，清除保存的应用
              removeCookie(CURRENT_APP)
            }
          } catch (_error) {
            // 解析失败，清除无效数据
            removeCookie(CURRENT_APP)
          }
        }

        return {
          userApps: apps,
          currentApp: validCurrentApp
        }
      }),
    
    setAppsLoading: (loading: boolean) =>
      set(() => ({ appsLoading: loading })),
    
    // 权限检查
    hasAppPermission: (appId: number, _permission = 'viewer') => {
      const state = get()
      if (!state.user || !state.currentApp) return false
      if (state.currentApp.id !== appId) return false
      
      // TODO: 实际的权限检查逻辑
      // 这里需要根据 UserAppPermission 数据进行检查
      return true
    },
  }
})
