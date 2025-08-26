import { useState } from 'react'
import { Loader2, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/auth-store'
import { AppService } from '@/services/app-service'
import { requireApp } from '@/utils/app-utils'
import { toast } from 'sonner'
import type { AppAPIKey } from '@/types/api'

interface DeleteApiKeyDialogProps {
  apiKey: AppAPIKey | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteApiKeyDialog({ apiKey, open, onOpenChange, onSuccess }: DeleteApiKeyDialogProps) {
  const { currentApp } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!requireApp(currentApp) || !apiKey) {
      return
    }

    try {
      setLoading(true)
      await AppService.deleteAPIKey(currentApp.id, apiKey.id)
      toast.success('删除API密钥成功')
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error((error as Error).message || '删除API密钥失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
    }
  }

  if (!apiKey) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            删除API密钥
          </DialogTitle>
          <DialogDescription>
            您即将删除以下 API 密钥，此操作不可恢复。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <div className="space-y-2">
              <div>
                <span className="font-medium">密钥名称：</span>
                <span className="ml-2">{apiKey.name}</span>
              </div>
              <div>
                <span className="font-medium">密钥ID：</span>
                <span className="ml-2 font-mono text-sm">{apiKey.id}</span>
              </div>
              <div>
                <span className="font-medium">密钥格式：</span>
                <span className="ml-2 font-mono text-sm">{apiKey.key_prefix}****************{apiKey.key_suffix}</span>
              </div>
              <div>
                <span className="font-medium">创建时间：</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {new Date(apiKey.created_at).toLocaleString('zh-CN', {
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

          <div className="flex items-start space-x-2 p-3 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 rounded-lg">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <div className="text-sm text-orange-800 dark:text-orange-200">
              删除API密钥后，使用此密钥的所有SDK连接将立即失效，请确保您已经更换了新的API密钥。
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
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
