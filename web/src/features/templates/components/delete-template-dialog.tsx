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
import { TemplateService } from '@/services/template-service'
import { toast } from 'sonner'
import type { MessageTemplate } from '@/types/api'

interface DeleteTemplateDialogProps {
  template: MessageTemplate
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteTemplateDialog({ template, open, onOpenChange, onSuccess }: DeleteTemplateDialogProps) {
  const { currentApp } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!currentApp) return

    try {
      setLoading(true)
      await TemplateService.deleteTemplate(currentApp.id, template.id)
      toast.success('模板删除成功')
      onSuccess()
    } catch (error) {
      toast.error((error as Error).message || '删除模板失败')
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
            删除模板
          </DialogTitle>
          <DialogDescription>
            您确定要删除模板 "{template.name}" 吗？此操作无法撤销。
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>警告：</strong>删除模板将会：
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>永久删除模板内容和配置</li>
              <li>影响使用此模板的定时推送任务</li>
              <li>无法恢复模板的历史版本</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border p-4 bg-muted/50">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">模板名称:</span>
              <span className="text-sm font-medium">{template.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">推送标题:</span>
              <span className="text-sm font-medium">{template.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">支持平台:</span>
              <span className="text-sm font-medium">{template.platform.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">版本:</span>
              <span className="text-sm font-medium">v{template.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">创建时间:</span>
              <span className="text-sm font-medium">
                {new Date(template.created_at).toLocaleString('zh-CN', {
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
