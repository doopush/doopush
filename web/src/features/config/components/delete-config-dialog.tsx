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
import { useAuthStore } from '@/stores/auth-store'
import { ConfigService } from '@/services/config-service'
import { Apple } from '@/components/platform-icon'
import { toast } from 'sonner'
import type { AppConfig } from '@/types/api'

interface DeleteConfigDialogProps {
  config: AppConfig
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteConfigDialog({ config, open, onOpenChange, onSuccess }: DeleteConfigDialogProps) {
  const { currentApp } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!currentApp) return

    try {
      setLoading(true)
      await ConfigService.deleteConfig(currentApp.id, config.id)
      toast.success('推送配置删除成功')
      onSuccess()
    } catch (error) {
      toast.error((error as Error).message || '删除推送配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
    }
  }

  const getChannelInfo = (channel: string) => {
    const channelMap: Record<string, { name: string; icon: React.ReactNode }> = {
      apns: { name: 'Apple Push', icon: <Apple className="h-6 w-6" /> },
      fcm: { name: 'Firebase Cloud Messaging', icon: '🔥' },
      huawei: { name: '华为推送', icon: '📱' },
      xiaomi: { name: '小米推送', icon: '📱' },
      oppo: { name: 'OPPO推送', icon: '📱' },
      vivo: { name: 'VIVO推送', icon: '📱' },
      honor: { name: '荣耀推送', icon: '📱' },
      samsung: { name: '三星推送', icon: '📱' },
    }
    return channelMap[channel] || { name: channel, icon: '📱' }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            删除推送配置
          </DialogTitle>
          <DialogDescription>
            您确定要删除此推送配置吗？此操作无法撤销。
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>警告：</strong>删除推送配置将会：
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>无法向该平台/通道发送推送</li>
              <li>正在进行的推送任务可能失败</li>
              <li>定时推送任务将无法执行</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border p-4 bg-muted/50">
          <div className="flex items-center gap-3 mb-3">
            {getChannelInfo(config.channel).icon}
            <div>
              <div className="font-medium">{getChannelInfo(config.channel).name}</div>
              <div className="text-sm text-muted-foreground">{config.channel}</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">平台:</span>
              <span className="text-sm font-medium">{config.platform.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">创建时间:</span>
              <span className="text-sm font-medium">
                {new Date(config.created_at).toLocaleString('zh-CN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">最后更新:</span>
              <span className="text-sm font-medium">
                {new Date(config.updated_at).toLocaleString('zh-CN')}
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
