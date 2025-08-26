import {
  BarChart3,
  LayoutDashboard,
  Send,
  HelpCircle,
  Package,
  Palette,
  Settings,
  UserCog,
  Smartphone,
  Clock,
  FileText,
  History,
  Shield,
  Activity,
  Tag,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  navGroups: [
    {
      title: '概览',
      items: [
        {
          title: '控制台',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: '应用管理',
          url: '/apps',
          icon: Package,
        },
      ],
    },
    {
      title: '数据管理',
      items: [
        {
          title: '设备管理',
          url: '/devices',
          icon: Smartphone,
        },
        {
          title: '设备分组',
          url: '/device-groups',
          icon: Shield,
        },
        {
          title: '用户标签',
          url: '/user-tags',
          icon: Tag,
        },
        {
          title: '消息模板',
          url: '/templates',
          icon: FileText,
        },
      ],
    },
    {
      title: '推送服务',
      items: [
        {
          title: '发送推送',
          url: '/push/send',
          icon: Send,
        },
        {
          title: '定时推送',
          url: '/scheduled-push',
          icon: Clock,
        },
        {
          title: '推送历史',
          url: '/push/logs',
          icon: History,
        },
        {
          title: '推送统计',
          url: '/push/statistics',
          icon: BarChart3,
        },
      ],
    },
    {
      title: '系统管理',
      items: [
        {
          title: '推送配置',
          url: '/config',
          icon: Settings,
        },
        {
          title: '审计日志',
          url: '/audit-logs',
          icon: Activity,
        },
        {
          title: '个人设置',
          icon: UserCog,
          items: [
            {
              title: '个人资料',
              url: '/settings/profile',
              icon: UserCog,
            },
            {
              title: '修改密码',
              url: '/settings/account',
              icon: Settings,
            },
            {
              title: '外观设置',
              url: '/settings/appearance',
              icon: Palette,
            },
          ],
        },
        {
          title: '帮助中心',
          url: 'https://doopush.com/docs',
          icon: HelpCircle,
          external: true,
        },
      ],
    },
  ],
}
