import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'
import type { User, App, AppRole } from '@/types/api'

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
  appsFetched: boolean
  
  // 认证操作
  setAuth: (user: User, token: string) => void
  setUser: (user: User | null) => void
  setToken: (token: string) => void
  logout: () => void
  
  // 应用操作
  setCurrentApp: (app: App | null) => void
  setUserApps: (apps: App[]) => void
  setAppsLoading: (loading: boolean) => void
  setAppsFetched: (fetched: boolean) => void
  
  // 权限检查
  hasAppPermission: (appId: number, permission?: AppRole) => boolean
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
    appsFetched: false,
    
    // 认证操作
    setAuth: (user: User, token: string) =>
      set(() => {
        setCookie(ACCESS_TOKEN, token)
        setCookie(CACHED_USER, JSON.stringify(user))
        return {
          user,
          token,
          isAuthenticated: true,
          appsFetched: false,
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
          appsLoading: false,
          appsFetched: false,
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
            const currentApp = apps.find(app => app.id === savedApp.id)
            if (currentApp) {
              // 使用接口返回的最新应用信息和角色，避免沿用过期缓存
              validCurrentApp = currentApp
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
    
    setAppsFetched: (fetched: boolean) =>
      set(() => ({ appsFetched: fetched })),
    
    // 权限检查
    hasAppPermission: (appId: number, permission = 'viewer') => {
      const state = get()
      if (!state.user) return false

      const app = state.userApps.find(item => item.id === appId)
      if (!app?.role) return false

      const roleLevel: Record<AppRole, number> = {
        viewer: 1,
        developer: 2,
        owner: 3,
      }
      return roleLevel[app.role] >= roleLevel[permission]
    },
  }
})
