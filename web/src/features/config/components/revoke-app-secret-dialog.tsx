import { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { AppService } from '@/services/app-service'
import type { App, AppSecret } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Props { app: App; secret: AppSecret | null; open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }

export function RevokeAppSecretDialog({ app, secret, open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  if (!secret) return null
  const revoke = async () => {
    try {
      setLoading(true)
      await AppService.revokeAppSecret(app.id, secret.id)
      toast.success('App Secret 已撤销')
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error((error as Error).message || '撤销 App Secret 失败')
    } finally { setLoading(false) }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-[460px]"><DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />撤销 App Secret</DialogTitle><DialogDescription>撤销“{secret.name}”后，使用它的服务端请求会立即失败。此操作不可恢复。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button><Button variant="destructive" onClick={revoke} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}确认撤销</Button></DialogFooter></DialogContent></Dialog>
}
