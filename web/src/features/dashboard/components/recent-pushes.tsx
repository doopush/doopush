import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import { PushService } from '@/services/push-service'
import { Apple, Android } from '@/components/platform-icon'
import type { PushLog } from '@/types/api'



export function RecentPushes() {
  const { currentApp } = useAuthStore()
  const [recentPushes, setRecentPushes] = useState<PushLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRecentPushes = async () => {
      if (!currentApp) return

      try {
        setLoading(true)

        // 调用真实的API获取最近的推送记录
        const response = await PushService.getPushLogs(currentApp.id, {
          page: 1,
          page_size: 5,
          filters: {
            status: undefined, // 获取所有状态
            platform: undefined  // 获取所有平台
          }
        })

        setRecentPushes(response.data.items)
      } catch (error) {
        console.error('Failed to load recent pushes:', error)
        setRecentPushes([])
      } finally {
        setLoading(false)
      }
    }

    if (currentApp) {
      loadRecentPushes()
    }
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

  const getPlatformIcon = (pushLog: PushLog) => {
    // 从设备信息中获取平台
    if (pushLog.device_platform) {
      return pushLog.device_platform === 'ios' ? <Apple className='h-5 w-5' /> : <Android className='h-5 w-5' />
    }
    // 默认返回Android图标
    return <Android className='h-5 w-5' />
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

  if (recentPushes.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <div className="text-center">
          <div className="text-sm mb-1">暂无推送记录</div>
          <div className="text-xs">发送第一个推送后，记录将在这里显示</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {recentPushes.map((push) => (
        <div key={push.id} className="flex items-start">
          <Avatar className="h-9 w-9">
            <AvatarFallback>
              {getPlatformIcon(push)}
            </AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium leading-none">
                {(push.status === 'failed' || push.failed_count > 0) && (
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