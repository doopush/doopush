import { useEffect, useMemo, useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { AppService } from '@/services/app-service'
import type { App, AppSecret, AppSecretScope } from '@/types/api'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogScrollBody, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { AppSecretScopeSelector } from './app-secret-scope-selector'
import { scopeLabel } from './app-secret-scopes'

interface Props {
  app: App
  secret: AppSecret | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditAppSecretScopesDialog({ app, secret, open, onOpenChange, onSuccess }: Props) {
  const [scopes, setScopes] = useState<AppSecretScope[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (open && secret) setScopes([...secret.scopes])
  }, [open, secret])

  const addedScopes = useMemo(() => scopes.filter((scope) => !secret?.scopes.includes(scope)), [scopes, secret])
  const removedScopes = useMemo(() => secret?.scopes.filter((scope) => !scopes.includes(scope)) ?? [], [scopes, secret])
  const hasChanges = addedScopes.length > 0 || removedScopes.length > 0
  const addsHighRiskScope = addedScopes.includes('push:broadcast')

  if (!secret) return null

  const save = async () => {
    try {
      setSaving(true)
      await AppService.updateAppSecretScopes(app.id, secret.id, scopes)
      toast.success('App Secret 权限已更新')
      setConfirmOpen(false)
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      toast.error((error as Error).message || '更新 App Secret 权限失败')
    } finally {
      setSaving(false)
    }
  }

  const submit = () => {
    if (addedScopes.length > 0) setConfirmOpen(true)
    else save()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />编辑 App Secret 权限</DialogTitle>
            <DialogDescription>修改“{secret.name}”的权限范围。保存后会立即影响使用该 Secret 的服务端请求。</DialogDescription>
          </DialogHeader>
          <DialogScrollBody>
            <AppSecretScopeSelector scopes={scopes} onChange={setScopes} idPrefix={`edit-secret-${secret.id}-scope`} />
          </DialogScrollBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
            <Button onClick={submit} disabled={saving || scopes.length === 0 || !hasChanges}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存权限</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={addsHighRiskScope ? '确认增加高风险权限？' : '确认增加权限？'}
        desc={
          <div className="space-y-3">
            <p>新增权限会立即扩大“{secret.name}”可以执行的操作。</p>
            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              <div className="font-medium">新增权限</div>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                {addedScopes.map((scope) => <li key={scope}>{scopeLabel(scope)}</li>)}
              </ul>
              {removedScopes.length > 0 && <><div className="mt-3 font-medium">同时移除</div><ul className="mt-1 list-inside list-disc text-muted-foreground">{removedScopes.map((scope) => <li key={scope}>{scopeLabel(scope)}</li>)}</ul></>}
            </div>
            {addsHighRiskScope && <p className="font-medium text-amber-700 dark:text-amber-400">全量广播可以向应用全部设备发送推送，请确认该服务确实需要此权限。</p>}
          </div>
        }
        confirmText="确认并保存"
        cancelBtnText="返回检查"
        destructive={addsHighRiskScope}
        isLoading={saving}
        handleConfirm={save}
      />
    </>
  )
}
