import { useState } from 'react'
import { AlertCircle, CheckCircle, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Props {
  open: boolean
  title: string
  description: string
  credentialLabel: string
  credential: string | null
  warning?: string
  onClose: () => void
}

export function CreatedCredentialDialog({ open, title, description, credentialLabel, credential, warning, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!credential) return
    try {
      await navigator.clipboard.writeText(credential)
      setCopied(true)
    } catch (_error) {
      toast.error('复制失败，请手动复制')
    }
  }

  const close = () => {
    setCopied(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[550px] [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-500">
            <CheckCircle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {credential && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">{credentialLabel}：</div>
              <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
                <code className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">{credential}</code>
                <Button
                  size="sm"
                  variant={copied ? 'default' : 'outline'}
                  onClick={copy}
                  className={copied ? 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600' : ''}
                >
                  {copied ? <CheckCircle className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                  {copied ? '已复制' : '复制'}
                </Button>
              </div>
            </div>

            {warning && (
              <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950/50">
                <AlertCircle className="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
                <div className="text-sm text-orange-800 dark:text-orange-200">{warning}</div>
              </div>
            )}

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/50">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <strong>重要提示：</strong>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  <li>请将此密钥保存在安全的地方</li>
                  <li>不要将密钥提交到代码库中</li>
                  <li>如果密钥泄露，请立即撤销并重新创建</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={close} className="w-full">我已保存密钥</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
