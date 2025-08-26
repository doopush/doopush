import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, Key, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,

  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

import { AppService } from '@/services/app-service'
import { toast } from 'sonner'
import type { App, AppAPIKey } from '@/types/api'

// 创建API密钥表单验证
const createAPIKeySchema = z.object({
  name: z.string().min(1, 'API密钥名称不能为空').max(100, '名称不能超过100个字符'),
  permissions: z.array(z.string()).min(1, '至少选择一个权限'),
  expires_days: z.number().min(1, '有效期至少1天').max(365, '有效期不能超过365天').optional(),
})

type CreateAPIKeyFormData = z.infer<typeof createAPIKeySchema>

interface APIKeysDialogProps {
  app: App
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function APIKeysDialog({ app, open, onOpenChange }: APIKeysDialogProps) {
  const [apiKeys, setAPIKeys] = useState<AppAPIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newAPIKey, setNewAPIKey] = useState<string | null>(null)

  const form = useForm<CreateAPIKeyFormData>({
    resolver: zodResolver(createAPIKeySchema),
    defaultValues: {
      name: '',
      permissions: ['push'],
      expires_days: 90,
    },
  })

  // 加载API密钥列表
  useEffect(() => {
    if (open && app) {
      loadAPIKeys()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, app])

  const loadAPIKeys = async () => {
    try {
      setLoading(true)
      const keys = await AppService.getAppAPIKeys(app.id)
      setAPIKeys(keys)
    } catch (error) {
      console.error('加载API密钥失败:', error)
      toast.error('加载API密钥失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAPIKey = async (data: CreateAPIKeyFormData) => {
    try {
      setCreating(true)
      const result = await AppService.createAPIKey(app.id, data)
      setNewAPIKey(result.api_key)
      setShowCreateForm(false)
      form.reset()
      loadAPIKeys()
      toast.success('API密钥创建成功')
    } catch (error) {
      toast.error((error as Error).message || '创建API密钥失败')
    } finally {
      setCreating(false)
    }
  }

  const handleCopyAPIKey = (key: string) => {
    navigator.clipboard.writeText(key)
    toast.success('API密钥已复制到剪贴板')
  }

  const getStatusBadge = (status: number) => {
    return status === 1 
      ? { label: '有效', className: 'bg-green-100 text-green-800' }
      : { label: '禁用', className: 'bg-red-100 text-red-800' }
  }

  const permissionLabels = {
    push: '推送权限',
    device: '设备管理',
    statistics: '统计查看',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API密钥管理
          </DialogTitle>
          <DialogDescription>
            管理应用 "{app.name}" 的API密钥，用于客户端SDK认证
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6 space-y-4">
          {/* 新创建的API密钥展示 */}
          {newAPIKey && (
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-green-800">API密钥创建成功</h4>
                  <p className="text-sm text-green-700 mt-1">
                    请立即复制并安全保存，此密钥不会再次显示
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNewAPIKey(null)}
                  className="text-green-700 border-green-200"
                >
                  关闭
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={newAPIKey}
                  readOnly
                  className="font-mono text-sm bg-white"
                />
                <Button
                  size="sm"
                  onClick={() => handleCopyAPIKey(newAPIKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* 创建API密钥表单 */}
          {showCreateForm && (
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-4">创建新的API密钥</h4>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateAPIKey)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>密钥名称</FormLabel>
                        <FormControl>
                          <Input placeholder="生产环境密钥" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="permissions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>权限</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(permissionLabels).map(([key, label]) => (
                            <label key={key} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={field.value.includes(key)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    field.onChange([...field.value, key])
                                  } else {
                                    field.onChange(field.value.filter(p => p !== key))
                                  }
                                }}
                              />
                              <span className="text-sm">{label}</span>
                            </label>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expires_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>有效期 (天)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            max="365"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateForm(false)}
                      disabled={creating}
                    >
                      取消
                    </Button>
                    <Button type="submit" disabled={creating}>
                      {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      创建密钥
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {/* API密钥列表 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">现有API密钥</h4>
              {!showCreateForm && (
                <Button
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                  disabled={loading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  创建密钥
                </Button>
              )}
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无API密钥
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>权限</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>最后使用</TableHead>
                    <TableHead>创建时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{apiKey.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            ****{apiKey.last_4 || apiKey.key_suffix}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {apiKey.permissions?.map((permission) => (
                            <Badge key={permission} variant="secondary" className="text-xs">
                              {permissionLabels[permission as keyof typeof permissionLabels] || permission}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(apiKey.status).className}>
                          {getStatusBadge(apiKey.status).label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {apiKey.last_used 
                          ? new Date(apiKey.last_used).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : '从未使用'
                        }
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(apiKey.created_at).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>


          <Button onClick={() => onOpenChange(false)}>
            关闭
          </Button>

      </DialogContent>
    </Dialog>
  )
}
