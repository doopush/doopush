import { useEffect, useState } from 'react'
import { Key, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogScrollBody,
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
import { Badge } from '@/components/ui/badge'

import { AppService } from '@/services/app-service'
import { toast } from 'sonner'
import type { App, AppAPIKey } from '@/types/api'
import { CreateApiKeyDialog } from '@/features/config/components/create-api-key-dialog'

interface APIKeysDialogProps {
  app: App
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function APIKeysDialog({ app, open, onOpenChange }: APIKeysDialogProps) {
  const [apiKeys, setAPIKeys] = useState<AppAPIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

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

  const getStatusBadge = (status: number) => {
    return status === 1
      ? { label: '有效', className: 'bg-green-100 text-green-800' }
      : { label: '禁用', className: 'bg-red-100 text-red-800' }
  }

  return (
    <>
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

          <DialogScrollBody className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">现有API密钥</h4>
                <Button
                  size="sm"
                  onClick={() => setCreateDialogOpen(true)}
                  disabled={loading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  创建密钥
                </Button>
              </div>

              {loading ? (
                <div className="h-12 bg-muted rounded animate-pulse" />
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无API密钥
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
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
                                minute: '2-digit',
                              })
                            : '从未使用'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(apiKey.created_at).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogScrollBody>

          <Button onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogContent>
      </Dialog>

      <CreateApiKeyDialog
        app={app}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={loadAPIKeys}
      />
    </>
  )
}
