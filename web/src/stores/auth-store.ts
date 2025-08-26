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
  
  // 认证操作
  setAuth: (user: User, token: string) => void
  setUser: (user: User | null) => void
  setToken: (token: string) => void
  logout: () => void
  
  // 应用操作
  setCurrentApp: (app: App | null) => void
  setUserApps: (apps: App[]) => void
  
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
        removeCookie(CURRENT_APP)
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
      set(() => ({ userApps: apps })),
    
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
