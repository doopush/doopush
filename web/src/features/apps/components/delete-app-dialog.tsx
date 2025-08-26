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
import { AppService } from '@/services/app-service'
import { toast } from 'sonner'
import type { App } from '@/types/api'

interface DeleteAppDialogProps {
  app: App
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteAppDialog({ app, open, onOpenChange, onSuccess }: DeleteAppDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    try {
      setLoading(true)
      await AppService.deleteApp(app.id)
      toast.success('应用删除成功')
      onSuccess()
    } catch (error) {
      toast.error((error as Error).message || '删除应用失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            删除应用
          </DialogTitle>
          <DialogDescription>
            您确定要删除应用 "{app.name}" 吗？此操作无法撤销。
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>警告：</strong>删除应用将会：
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>永久删除所有设备数据</li>
              <li>清除所有推送历史记录</li>
              <li>删除所有消息模板</li>
              <li>撤销所有API密钥</li>
              <li>停止所有定时推送任务</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border p-4 bg-muted/50">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">应用名称:</span>
              <span className="text-sm font-medium">{app.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">包名:</span>
              <span className="text-sm font-medium">{app.package_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">平台:</span>
              <span className="text-sm font-medium">{app.platform.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">创建时间:</span>
              <span className="text-sm font-medium">
                {new Date(app.created_at).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
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
