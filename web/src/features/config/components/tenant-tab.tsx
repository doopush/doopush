import { useCallback, useEffect, useState } from 'react'
import { Ban, CheckCircle, Gauge, Loader2, MoreHorizontal, RefreshCw, Save, Trash2, Users } from 'lucide-react'
import { AppService } from '@/services/app-service'
import { useAuthStore } from '@/stores/auth-store'
import type { Tenant } from '@/types/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const formatTime = (value: string | null) => value
  ? new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '从未使用'

const parseQuota = (value: string) => {
  const quota = Number(value)
  return Number.isInteger(quota) && quota >= 0 ? quota : null
}

export function TenantTab() {
  const { currentApp, setCurrentApp } = useAuthStore()
  const isOwner = currentApp?.role === 'owner'
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(false)
  const [registration, setRegistration] = useState(false)
  const [defaultQuota, setDefaultQuota] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [quotaOpen, setQuotaOpen] = useState(false)
  const [quotaValue, setQuotaValue] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [acting, setActing] = useState(false)

  const loadTenants = useCallback(async () => {
    if (!currentApp || currentApp.role === 'viewer') return
    try {
      setLoading(true)
      setTenants(await AppService.getTenants(currentApp.id))
    } catch (error) {
      toast.error((error as Error).message || '加载租户列表失败')
    } finally { setLoading(false) }
  }, [currentApp])

  useEffect(() => { loadTenants() }, [loadTenants])
  useEffect(() => {
    setRegistration(!!currentApp?.tenant_registration)
    setDefaultQuota(String(currentApp?.tenant_daily_quota ?? 10000))
  }, [currentApp?.id, currentApp?.tenant_registration, currentApp?.tenant_daily_quota])

  if (!currentApp) return null

  const saveSettings = async () => {
    const quota = parseQuota(defaultQuota)
    if (quota === null) {
      toast.error('每日推送上限必须是不小于 0 的整数')
      return
    }
    try {
      setSavingSettings(true)
      const settings = await AppService.updateTenantSettings(currentApp.id, { tenant_registration: registration, tenant_daily_quota: quota })
      setCurrentApp({ ...currentApp, ...settings })
      toast.success('租户设置已保存')
    } catch (error) {
      toast.error((error as Error).message || '保存租户设置失败')
    } finally { setSavingSettings(false) }
  }

  const updateTenant = async (tenant: Tenant, data: { status?: number; daily_quota?: number }, message: string) => {
    try {
      setActing(true)
      await AppService.updateTenant(currentApp.id, tenant.id, data)
      toast.success(message)
      setQuotaOpen(false)
      loadTenants()
    } catch (error) {
      toast.error((error as Error).message || '更新租户失败')
    } finally { setActing(false) }
  }

  const saveQuota = () => {
    const quota = parseQuota(quotaValue)
    if (!selected || quota === null) {
      toast.error('每日推送上限必须是不小于 0 的整数')
      return
    }
    updateTenant(selected, { daily_quota: quota }, '每日推送上限已更新')
  }

  const deleteTenant = async () => {
    if (!selected) return
    try {
      setActing(true)
      await AppService.deleteTenant(currentApp.id, selected.id)
      toast.success('租户已删除')
      setDeleteOpen(false)
      loadTenants()
    } catch (error) {
      toast.error((error as Error).message || '删除租户失败')
    } finally { setActing(false) }
  }

  const appQuota = currentApp.tenant_daily_quota ?? 10000
  const quotaLabel = (tenant: Tenant) => {
    const quota = tenant.daily_quota > 0 ? tenant.daily_quota : appQuota
    return quota > 0 ? `${tenant.today_push_count} / ${quota}` : `${tenant.today_push_count} / 不限`
  }

  return <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />租户设置</CardTitle>
        <CardDescription>
          租户用于共享本应用的推送能力：接入方（如私有部署的业务服务器）用 App Key 自助注册获得租户密钥，
          只能绑定登录过它的设备（凭设备推送 Token）并向这些设备推送，无需持有 App Secret。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="tenant-registration">允许租户自助注册</Label>
            <p className="text-sm text-muted-foreground">关闭后不再接受新注册，已有租户不受影响。同一 IP 24 小时内最多注册 10 个。</p>
          </div>
          <Switch id="tenant-registration" checked={registration} onCheckedChange={setRegistration} disabled={!isOwner} />
        </div>
        <div className="space-y-2 rounded-lg border p-4">
          <Label htmlFor="tenant-quota">租户默认每日推送上限</Label>
          <Input id="tenant-quota" type="number" min={0} value={defaultQuota} onChange={(e) => setDefaultQuota(e.target.value)} disabled={!isOwner} />
          <p className="text-sm text-muted-foreground">按设备条数计算，0 表示不限。单个租户可单独设置。</p>
        </div>
        {isOwner && <div className="md:col-span-2 flex justify-end">
          <Button onClick={saveSettings} disabled={savingSettings}>{savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}保存设置</Button>
        </div>}
      </CardContent>
    </Card>

    {currentApp.role !== 'viewer' && <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2"><Users className="h-5 w-5" />租户列表</div>
          <Button variant="outline" onClick={loadTenants} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />刷新</Button>
        </CardTitle>
        <CardDescription>名称和站点由接入方自报，仅供识别。禁用后该租户的请求返回 403；删除后其密钥失效，接入方会重新注册为新租户。</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <div className="py-8 text-center text-muted-foreground">加载中...</div> : tenants.length === 0 ? <div className="py-8 text-center text-muted-foreground">暂无租户</div> : <Table>
          <TableHeader><TableRow><TableHead>租户</TableHead><TableHead>密钥</TableHead><TableHead>设备数</TableHead><TableHead>今日推送</TableHead><TableHead>状态</TableHead><TableHead>最后使用</TableHead><TableHead>注册 IP</TableHead>{isOwner && <TableHead className="text-right">操作</TableHead>}</TableRow></TableHeader>
          <TableBody>{tenants.map((tenant) => <TableRow key={tenant.id}>
            <TableCell><div className="font-medium">{tenant.name}</div>{tenant.site_url && <div className="max-w-[240px] truncate text-sm text-muted-foreground" title={tenant.site_url}>{tenant.site_url}</div>}</TableCell>
            <TableCell><code className="rounded bg-muted px-2 py-1 font-mono text-sm">dp_ts_****{tenant.suffix}</code></TableCell>
            <TableCell>{tenant.device_count}</TableCell>
            <TableCell>{quotaLabel(tenant)}{tenant.daily_quota > 0 && <Badge variant="outline" className="ml-2">自定义</Badge>}</TableCell>
            <TableCell><Badge variant={tenant.status === 1 ? 'default' : 'secondary'}>{tenant.status === 1 ? '正常' : '已禁用'}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatTime(tenant.last_used_at)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{tenant.register_ip}</TableCell>
            {isOwner && <TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0" title="租户操作"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setSelected(tenant); setQuotaValue(String(tenant.daily_quota)); setQuotaOpen(true) }}><Gauge className="mr-2 h-4 w-4" />设置每日上限</DropdownMenuItem>
              {tenant.status === 1
                ? <DropdownMenuItem onClick={() => updateTenant(tenant, { status: 0 }, '租户已禁用')}><Ban className="mr-2 h-4 w-4" />禁用</DropdownMenuItem>
                : <DropdownMenuItem onClick={() => updateTenant(tenant, { status: 1 }, '租户已启用')}><CheckCircle className="mr-2 h-4 w-4" />启用</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => { setSelected(tenant); setDeleteOpen(true) }}><Trash2 className="mr-2 h-4 w-4" />删除</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu></TableCell>}
          </TableRow>)}</TableBody>
        </Table>}
      </CardContent>
    </Card>}

    <Dialog open={quotaOpen} onOpenChange={(open) => !acting && setQuotaOpen(open)}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader><DialogTitle>设置每日推送上限</DialogTitle><DialogDescription>租户“{selected?.name}”的每日推送上限，0 表示使用应用默认值（当前 {appQuota > 0 ? appQuota : '不限'}）。</DialogDescription></DialogHeader>
        <Input type="number" min={0} value={quotaValue} onChange={(e) => setQuotaValue(e.target.value)} />
        <DialogFooter><Button variant="outline" onClick={() => setQuotaOpen(false)} disabled={acting}>取消</Button><Button onClick={saveQuota} disabled={acting}>{acting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={deleteOpen}
      onOpenChange={(open) => !acting && setDeleteOpen(open)}
      title="删除租户"
      desc={`删除“${selected?.name ?? ''}”后，其密钥立即失效并解除全部设备绑定。接入方下次请求会重新注册为新租户。`}
      cancelBtnText="取消"
      confirmText="确认删除"
      destructive
      isLoading={acting}
      handleConfirm={deleteTenant}
    />
  </div>
}
