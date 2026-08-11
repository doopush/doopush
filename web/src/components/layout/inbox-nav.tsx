import { useEffect, useState } from 'react'
import { Bell, Check, CheckCheck, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AppService } from '@/services/app-service'
import { InboxService } from '@/services/inbox-service'
import { useAuthStore } from '@/stores/auth-store'
import type { AppInvitation, AppRole, InvitationStatus } from '@/types/api'

const roleLabels: Record<AppRole, string> = {
  owner: '所有者',
  developer: '开发者',
  viewer: '观察者',
}

const statusLabels: Record<InvitationStatus, string> = {
  pending: '待处理',
  accepted: '已接受',
  rejected: '已拒绝',
  cancelled: '已撤回',
}

export function InboxButton() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const setUserApps = useAuthStore(state => state.setUserApps)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppInvitation[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    const loadCount = async () => {
      try {
        setUnreadCount(await InboxService.getUnreadCount())
      } catch {
        // 收件箱不可用不阻断其他页面。
      }
    }
    void loadCount()
    const timer = window.setInterval(loadCount, 30_000)
    return () => window.clearInterval(timer)
  }, [isAuthenticated])

  useEffect(() => {
    if (!open) return
    const loadInbox = async () => {
      try {
        setLoading(true)
        setItems(await InboxService.getInbox())
      } catch (error) {
        toast.error((error as Error).message || '加载收件箱失败')
      } finally {
        setLoading(false)
      }
    }
    void loadInbox()
  }, [open])

  const replaceItem = (updated: AppInvitation, wasUnread: boolean) => {
    setItems(current => current.map(item => item.id === updated.id ? updated : item))
    if (wasUnread) setUnreadCount(current => Math.max(0, current - 1))
  }

  const markRead = async (item: AppInvitation) => {
    if (item.read_at) return
    try {
      await InboxService.markRead(item.id)
      const readAt = new Date().toISOString()
      setItems(current => current.map(entry => entry.id === item.id ? { ...entry, read_at: readAt } : entry))
      setUnreadCount(current => Math.max(0, current - 1))
    } catch {
      toast.error('更新已读状态失败')
    }
  }

  const markAllRead = async () => {
    try {
      await InboxService.markAllRead()
      const readAt = new Date().toISOString()
      setItems(current => current.map(item => ({ ...item, read_at: item.read_at || readAt })))
      setUnreadCount(0)
    } catch {
      toast.error('全部标为已读失败')
    }
  }

  const respond = async (item: AppInvitation, accept: boolean) => {
    try {
      setProcessingId(item.id)
      const updated = accept ? await InboxService.accept(item.id) : await InboxService.reject(item.id)
      replaceItem(updated, !item.read_at)
      if (accept) {
        try {
          setUserApps(await AppService.getApps())
        } catch {
          toast.error('邀请已接受，但应用列表刷新失败')
        }
        toast.success(`已加入 ${item.app_name}`)
      } else {
        toast.success('已拒绝邀请')
      }
    } catch (error) {
      toast.error((error as Error).message || '处理邀请失败')
      try {
        const [latestItems, latestCount] = await Promise.all([
          InboxService.getInbox(),
          InboxService.getUnreadCount(),
        ])
        setItems(latestItems)
        setUnreadCount(latestCount)
      } catch {
        // 保留原列表，下一次轮询或打开收件箱时会再次刷新。
      }
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='relative h-8 w-8'
          aria-label='收件箱'
          title='收件箱'
        >
          <Bell className='h-4 w-4' />
          {unreadCount > 0 && (
            <span className='absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-white'>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className='w-full gap-0 sm:max-w-md'>
        <SheetHeader className='border-b'>
          <div className='flex items-center justify-between gap-4 pe-8'>
            <div>
              <SheetTitle>收件箱</SheetTitle>
              <SheetDescription>{unreadCount > 0 ? `${unreadCount} 条未读消息` : '没有未读消息'}</SheetDescription>
            </div>
            {unreadCount > 0 && (
              <Button variant='ghost' size='sm' onClick={() => void markAllRead()}>
                <CheckCheck className='h-4 w-4' />
                全部已读
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className='min-h-0 flex-1 overflow-y-auto'>
          {loading ? (
            <div className='space-y-3 p-4'>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className='h-28 animate-pulse rounded bg-muted' />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className='flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground'>
              <Bell className='h-8 w-8' />
              <span className='text-sm'>暂无消息</span>
            </div>
          ) : (
            <div className='divide-y'>
              {items.map(item => {
                const processing = processingId === item.id
                return (
                  <div
                    key={item.id}
                    className={`relative space-y-3 px-4 py-4 ${item.read_at ? '' : 'bg-muted/40'}`}
                  >
                    {!item.read_at && (
                      <Button
                        variant='ghost'
                        size='icon'
                        className='absolute end-2 top-2 h-8 w-8'
                        onClick={() => void markRead(item)}
                        aria-label='标为已读'
                        title='标为已读'
                      >
                        <Check className='h-4 w-4' />
                      </Button>
                    )}
                    <div className='pe-5'>
                      <div className='text-sm font-medium'>{item.app_name}</div>
                      <p className='mt-1 text-sm text-muted-foreground'>
                        {item.inviter_name} 邀请你以{roleLabels[item.role]}身份管理该应用
                      </p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant={item.status === 'pending' ? 'default' : 'secondary'}>
                        {statusLabels[item.status]}
                      </Badge>
                      <span className='text-xs text-muted-foreground'>
                        {new Date(item.created_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    {item.status === 'pending' && (
                      <div className='flex gap-2 justify-end'>
                        <Button size='sm' onClick={() => void respond(item, true)} disabled={processing}>
                          {processing ? <Loader2 className='h-4 w-4 animate-spin' /> : <Check className='h-4 w-4' />}
                          接受
                        </Button>
                        <Button size='sm' variant='outline' onClick={() => void respond(item, false)} disabled={processing}>
                          <X className='h-4 w-4' />
                          拒绝
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
