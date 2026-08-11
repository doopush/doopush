import { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { AppService } from '@/services/app-service'
import type { App, AppSecretScope } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogScrollBody, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { AppSecretScopeSelector } from './app-secret-scope-selector'
import { CreatedCredentialDialog } from './created-credential-dialog'

interface Props {
  app: App
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateAppSecretDialog({ app, open, onOpenChange, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [scopes, setScopes] = useState<AppSecretScope[]>(['push:send'])
  const [loading, setLoading] = useState(false)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)

  const create = async () => {
    if (!name.trim() || scopes.length === 0) return
    try {
      setLoading(true)
      const result = await AppService.createAppSecret(app.id, {
        name: name.trim(), scopes,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      setCreatedSecret(result.app_secret)
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      toast.error((error as Error).message || '创建 App Secret 失败')
    } finally {
      setLoading(false)
    }
  }

  const close = () => {
    if (loading) return
    setName('')
    setExpiresAt('')
    setScopes(['push:send'])
    setCreatedSecret(null)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />创建 App Secret</DialogTitle>
            <DialogDescription>用于服务端 API 调用，不得包含在客户端应用或前端代码中。</DialogDescription>
          </DialogHeader>
          <DialogScrollBody className="space-y-5">
              <div className="space-y-2"><Label htmlFor="secret-name">名称</Label><Input id="secret-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：生产推送服务" maxLength={100} /></div>
              <AppSecretScopeSelector scopes={scopes} onChange={setScopes} idPrefix="create-secret-scope" />
              <div className="space-y-2"><Label htmlFor="secret-expiry">过期时间（可选）</Label><Input id="secret-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></div>
          </DialogScrollBody>
          <DialogFooter><Button variant="outline" onClick={close}>取消</Button><Button onClick={create} disabled={loading || !name.trim() || scopes.length === 0}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}创建</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <CreatedCredentialDialog
        open={Boolean(createdSecret)}
        title="App Secret 创建成功"
        description="请立即复制并保存您的 App Secret，此密钥不会再次显示。"
        credentialLabel="您的 App Secret"
        credential={createdSecret}
        onClose={close}
      />
    </>
  )
}
