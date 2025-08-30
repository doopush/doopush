import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Key, Copy, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth-store'
import { AppService } from '@/services/app-service'
import { requireApp } from '@/utils/app-utils'
import { toast } from 'sonner'

// 表单验证规则
const createApiKeySchema = z.object({
  name: z.string().min(1, '请输入密钥名称').max(100, '密钥名称不能超过100个字符'),
})

type CreateApiKeyFormData = z.infer<typeof createApiKeySchema>

interface CreateApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateApiKeyDialog({ open, onOpenChange, onSuccess }: CreateApiKeyDialogProps) {
  const { currentApp } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [createdKey, setCreatedKey] = useState<{ api_key: string; warning?: string } | null>(null)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [copied, setCopied] = useState(false)

  const form = useForm<CreateApiKeyFormData>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: {
      name: '',
    },
  })

  const onSubmit = async (data: CreateApiKeyFormData) => {
    if (!requireApp(currentApp)) {
      return
    }

    try {
      setLoading(true)
      const result = await AppService.createAPIKey(currentApp.id, data)
      
      // 设置创建成功的密钥信息
      setCreatedKey({
        api_key: result.api_key,
        warning: result.warning
      })
      
      // 关闭创建对话框，显示成功对话框
      onOpenChange(false)
      setShowSuccessDialog(true)
      form.reset()
      onSuccess()
    } catch (error) {
      toast.error((error as Error).message || '创建API密钥失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      form.reset()
      onOpenChange(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }

  const handleSuccessClose = () => {
    setShowSuccessDialog(false)
    setCreatedKey(null)
    setCopied(false)
  }

  return (
    <>
      {/* 创建API密钥对话框 */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              创建API密钥
            </DialogTitle>
            <DialogDescription>
              创建新的API密钥用于SDK认证。密钥创建后只能查看一次，请妥善保存。
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto -mx-6 px-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>密钥名称 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例如：iOS生产环境密钥"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              取消
            </Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建密钥
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建成功对话框 - 禁止点击背景关闭 */}
      <Dialog open={showSuccessDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[550px] [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              API密钥创建成功
            </DialogTitle>
            <DialogDescription>
              请立即复制并保存您的API密钥，此密钥不会再次显示。
            </DialogDescription>
          </DialogHeader>

          {createdKey && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  您的API密钥：
                </label>
                <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg border">
                  <code className="flex-1 text-sm font-mono text-foreground break-all">
                    {createdKey.api_key}
                  </code>
                  <Button
                    size="sm"
                    variant={copied ? "default" : "outline"}
                    onClick={() => copyToClipboard(createdKey.api_key)}
                    className={copied ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600" : ""}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="mr-1 h-4 w-4" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-4 w-4" />
                        复制
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {createdKey.warning && (
                <div className="flex items-start space-x-2 p-3 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                  <div className="text-sm text-orange-800 dark:text-orange-200">
                    {createdKey.warning}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>重要提示：</strong>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    <li>请将此密钥保存在安全的地方</li>
                    <li>不要将密钥提交到代码库中</li>
                    <li>如果密钥泄露，请立即删除并重新创建</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={handleSuccessClose} className="w-full">
              我已保存密钥
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
