import { useCallback, useEffect, useState } from 'react'
import { Copy, Eye, EyeOff, KeyRound, MoreHorizontal, Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import { AppService } from '@/services/app-service'
import { useAuthStore } from '@/stores/auth-store'
import type { AppSecret } from '@/types/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { CreateAppSecretDialog } from './create-app-secret-dialog'
import { RevokeAppSecretDialog } from './revoke-app-secret-dialog'
import { EditAppSecretScopesDialog } from './edit-app-secret-scopes-dialog'
import { scopeLabel } from './app-secret-scopes'

export function AppConfigTab() {
  const { currentApp } = useAuthStore()
  const [secrets, setSecrets] = useState<AppSecret[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [editScopesOpen, setEditScopesOpen] = useState(false)
  const [selectedSecret, setSelectedSecret] = useState<AppSecret | null>(null)
  const [appKeyVisible, setAppKeyVisible] = useState(false)

  const loadSecrets = useCallback(async () => {
    if (!currentApp || currentApp.role !== 'owner') return
    try {
      setLoading(true)
      setSecrets(await AppService.getAppSecrets(currentApp.id))
    } catch (error) {
      toast.error((error as Error).message || '加载 App Secret 失败')
    } finally { setLoading(false) }
  }, [currentApp])

  useEffect(() => { loadSecrets() }, [loadSecrets])
  useEffect(() => { setAppKeyVisible(false) }, [currentApp?.id])
  if (!currentApp) return null

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    toast.success(`${label}已复制`)
  }

  return <div className="space-y-6">
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />客户端接入</CardTitle><CardDescription>App ID 和 App Key 可以包含在客户端应用中，只用于 SDK 注册。</CardDescription></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="app-id">App ID</Label><div className="flex gap-2"><Input id="app-id" value={currentApp.id} readOnly className="bg-muted" /><Button size="icon" variant="outline" title="复制 App ID" onClick={() => copy(String(currentApp.id), 'App ID')}><Copy className="h-4 w-4" /></Button></div></div>
        <div className="space-y-2"><Label htmlFor="bundle-id">Bundle ID</Label><Input id="bundle-id" value={currentApp.package_name} readOnly className="bg-muted" /></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="app-key">App Key</Label><div className="flex gap-2"><Input id="app-key" type={appKeyVisible ? 'text' : 'password'} value={currentApp.app_key || ''} readOnly className="bg-muted font-mono" /><Button type="button" size="icon" variant="outline" title={appKeyVisible ? '隐藏 App Key' : '显示 App Key'} aria-label={appKeyVisible ? '隐藏 App Key' : '显示 App Key'} onClick={() => setAppKeyVisible((visible) => !visible)} disabled={!currentApp.app_key}>{appKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button><Button size="icon" variant="outline" title={appKeyVisible ? '复制 App Key' : '请先显示 App Key'} onClick={() => copy(currentApp.app_key, 'App Key')} disabled={!currentApp.app_key || !appKeyVisible}><Copy className="h-4 w-4" /></Button></div></div>
      </CardContent>
    </Card>

    {currentApp.role === 'owner' && <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2"><KeyRound className="h-5 w-5" />App Secrets</div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />创建 App Secret</Button>
        </CardTitle>
        <CardDescription>仅用于服务端 API。每个后端服务应使用独立 Secret 和最小权限。</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <div className="py-8 text-center text-muted-foreground">加载中...</div> : secrets.length === 0 ? <div className="py-8 text-center text-muted-foreground">尚未创建 App Secret，请先创建一个</div> : <Table>
          <TableHeader><TableRow><TableHead>密钥名称</TableHead><TableHead>App Secret</TableHead><TableHead>权限</TableHead><TableHead>状态</TableHead><TableHead>最后使用</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
          <TableBody>{secrets.map((secret) => {
            const active = secret.status === 1 && !secret.revoked_at && (!secret.expires_at || new Date(secret.expires_at) > new Date())
            return <TableRow key={secret.id} className="group"><TableCell className="font-medium">{secret.name}</TableCell><TableCell><code className="rounded bg-muted px-2 py-1 font-mono text-sm">{secret.prefix}****************{secret.suffix}</code></TableCell><TableCell><div className="flex max-w-md flex-wrap gap-1">{secret.scopes.map((scope) => <Badge key={scope} variant="secondary">{scopeLabel(scope)}</Badge>)}</div></TableCell><TableCell><Badge variant={active ? 'default' : 'secondary'}>{active ? '有效' : '已失效'}</Badge></TableCell><TableCell className="text-sm text-muted-foreground">{secret.last_used_at ? new Date(secret.last_used_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '从未使用'}</TableCell><TableCell className="text-right">{active && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0" title="App Secret 操作"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { setSelectedSecret(secret); setEditScopesOpen(true) }}><Pencil className="mr-2 h-4 w-4" />编辑权限</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => { setSelectedSecret(secret); setRevokeOpen(true) }}><Trash2 className="mr-2 h-4 w-4" />撤销 Secret</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</TableCell></TableRow>
          })}</TableBody>
        </Table>}
      </CardContent>
    </Card>}

    <CreateAppSecretDialog app={currentApp} open={createOpen} onOpenChange={setCreateOpen} onSuccess={loadSecrets} />
    <EditAppSecretScopesDialog app={currentApp} secret={selectedSecret} open={editScopesOpen} onOpenChange={setEditScopesOpen} onSuccess={loadSecrets} />
    <RevokeAppSecretDialog app={currentApp} secret={selectedSecret} open={revokeOpen} onOpenChange={setRevokeOpen} onSuccess={loadSecrets} />
  </div>
}
