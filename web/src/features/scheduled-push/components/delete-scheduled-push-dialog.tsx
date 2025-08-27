import { useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import { ScheduledPushService } from '@/services/scheduled-push-service'
import { toast } from 'sonner'
import type { ScheduledPush } from '@/types/api'

interface DeleteScheduledPushDialogProps {
  push: ScheduledPush
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteScheduledPushDialog({ push, open, onOpenChange, onSuccess }: DeleteScheduledPushDialogProps) {
  const { currentApp } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!currentApp) return

    try {
      setLoading(true)
      await ScheduledPushService.deleteScheduledPush(currentApp.id, push.id)
      toast.success('定时推送任务删除成功')
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error((error as Error).message || '删除定时推送任务失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
    }
  }

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: '等待中',
      running: '运行中',
      paused: '已暂停',
      completed: '已完成',
      failed: '失败',
    }
    return labels[status as keyof typeof labels] || status
  }

  const getRepeatLabel = (repeatType: string) => {
    const labels = {
      none: '单次',
      daily: '每日',
      weekly: '每周',
      monthly: '每月',
    }
    return labels[repeatType as keyof typeof labels] || repeatType
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            删除定时推送
          </DialogTitle>
          <DialogDescription>
            您确定要删除此定时推送任务吗？此操作无法撤销。
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="border-destructive/20 bg-destructive/5 dark:border-destructive/20 dark:bg-destructive/5">
          <AlertDescription className="text-destructive dark:text-destructive">
            <strong>警告：</strong>删除定时推送任务将会：
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>永久删除任务配置和历史记录</li>
              <li>停止所有未来的推送执行</li>
              <li>无法恢复删除的任务数据</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border p-4 bg-muted/50">
          <div className="space-y-3">
            <div>
              <div className="font-medium text-lg">{push.title}</div>
              <div className="text-sm text-muted-foreground line-clamp-2">
                {push.content}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">状态：</span>
                <Badge className="ml-1" variant={push.status === 'running' ? 'default' : 'secondary'}>
                  {getStatusLabel(push.status)}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">重复：</span>
                <Badge variant="outline" className="ml-1">
                  {getRepeatLabel(push.repeat_type)}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">执行时间：</span>
                <span className="font-medium ml-1">
                  {(() => {
                    try {
                      const date = new Date(push.scheduled_at)
                      return isNaN(date.getTime()) ? '无效时间' : date.toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    } catch {
                      return '无效时间'
                    }
                  })()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">推送类型：</span>
                <span className="font-medium ml-1">
                  {push.push_type === 'single' ? '单设备' : 
                   push.push_type === 'batch' ? '批量推送' : '广播推送'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleClose}
            disabled={loading}
          >
            取消
          </Button>
          <Button 
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
