import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import { Apple, Android } from '@/components/platform-icon'

interface Push {
  id: number
  title: string
  content: string
  status: string
  platform: string
  created_at: string
}

export function RecentPushes() {
  const { currentApp } = useAuthStore()
  const [recentPushes, setRecentPushes] = useState<Push[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRecentPushes = async () => {
      if (!currentApp) return
      
      try {
        setLoading(true)
        // 获取最近的推送记录（这里暂时使用模拟数据）
        const mockData: Push[] = [
          {
            id: 1,
            title: '系统维护通知',
            content: '系统将在今晚进行维护，请提前保存工作',
            status: 'success',
            platform: 'ios',
            created_at: '2024-01-15T10:30:00Z'
          },
          {
            id: 2,
            title: '新功能上线',
            content: '推送平台新增批量推送功能',
            status: 'success',
            platform: 'android',
            created_at: '2024-01-15T09:15:00Z'
          },
          {
            id: 3,
            title: '促销活动',
            content: '限时优惠活动已开始，快来参与吧！',
            status: 'failed',
            platform: 'ios',
            created_at: '2024-01-15T08:00:00Z'
          },
          {
            id: 4,
            title: '安全提醒',
            content: '检测到异常登录，请及时修改密码',
            status: 'success',
            platform: 'android',
            created_at: '2024-01-14T16:45:00Z'
          },
          {
            id: 5,
            title: '版本更新',
            content: '应用已更新到最新版本，请及时升级',
            status: 'success',
            platform: 'ios',
            created_at: '2024-01-14T14:20:00Z'
          }
        ]
        setRecentPushes(mockData)
      } catch (error) {
        console.error('Failed to load recent pushes:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRecentPushes()
  }, [currentApp])

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const currentYear = now.getFullYear()
    const dateYear = date.getFullYear()
    
    // 完整的时间标签（年/月/日 时:分:秒）
    const fullTime = date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/\//g, '/').replace(/,/g, '')
    
    // 显示的时间格式
    let displayTime: string
    if (dateYear === currentYear) {
      // 今年：月/日 时:分
      displayTime = date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\//g, '/').replace(/,/g, ' ')
    } else {
      // 去年或其他年份：年/月/日
      displayTime = date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '/')
    }
    
    return { displayTime, fullTime }
  }

  const getPlatformIcon = (platform: string) => {
    return platform === 'ios' ? <Apple className='h-5 w-5' /> : <Android className='h-5 w-5' />
  }

  if (loading) {
    return (
      <div className="space-y-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center">
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
            <div className="ml-4 space-y-1 flex-1">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
            </div>
            <div className="h-6 w-16 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {recentPushes.map((push) => (
        <div key={push.id} className="flex items-start">
          <Avatar className="h-9 w-9">
            <AvatarFallback>
              {getPlatformIcon(push.platform)}
            </AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium leading-none">
                {push.status === 'failed' && (
                  <Badge variant="outline" className="mr-1 text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                    失败
                  </Badge>
                )}
                {push.title}
              </p>
              <p className="text-xs text-muted-foreground" title={formatTime(push.created_at).fullTime}>
                {formatTime(push.created_at).displayTime}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {push.content.length > 40 ? `${push.content.substring(0, 40)}...` : push.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}