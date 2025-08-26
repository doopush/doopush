import { toast } from 'sonner'
import type { App, User } from '@/types/api'

/**
 * 检查是否已选择应用，如果未选择则显示错误提示
 * @param currentApp 当前选中的应用
 * @param errorMessage 自定义错误信息，默认为"请先选择应用"
 * @returns 是否已选择应用
 */
export function requireApp(currentApp: App | null, errorMessage?: string): currentApp is App {
  if (!currentApp) {
    toast.error(errorMessage || '请先选择应用')
    return false
  }
  return true
}

/**
 * 获取针对不同页面的默认描述文案
 */
export const APP_SELECTION_DESCRIPTIONS = {
  dashboard: '请先在左侧选择一个应用来查看推送统计数据',
  pushSend: '请先选择一个应用来发送推送',
  pushLogs: '请先选择一个应用来查看推送记录',
  pushStatistics: '请先选择一个应用来查看推送统计',
  templates: '请先选择一个应用来管理消息模板',
  config: '请先选择一个应用来管理推送配置',
  devices: '请先选择一个应用来查看其设备列表',
  deviceGroups: '请先选择一个应用来管理设备分组',
  userTags: '请在左侧边栏选择一个应用来管理用户标签',
  scheduledPush: '选择应用后查看定时推送',
} as const

export type AppSelectionPage = keyof typeof APP_SELECTION_DESCRIPTIONS

/**
 * 检查用户是否已登录，如果未登录则显示错误提示
 * @param user 当前登录的用户
 * @param isAuthenticated 认证状态
 * @param errorMessage 自定义错误信息，默认为"请先登录"
 * @returns 是否已登录
 */
export function requireAuth(
  user: User | null, 
  isAuthenticated: boolean, 
  errorMessage?: string
): user is User {
  if (!user || !isAuthenticated) {
    toast.error(errorMessage || '请先登录')
    return false
  }
  return true
}

/**
 * 处理图标URL，将相对路径转换为完整URL（暂时不处理，留着备用）
 * @param iconPath 图标路径
 * @returns 完整的图标URL
 */
export function getIconURL(iconPath: string): string {
  return iconPath
}