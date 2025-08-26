import { useState, useEffect } from 'react'
import {
  Settings,
  Plus,
  Copy,
  Trash2,
  MoreHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useAuthStore } from '@/stores/auth-store'
import { AppService } from '@/services/app-service'
import { CreateApiKeyDialog } from './create-api-key-dialog'
import { DeleteApiKeyDialog } from './delete-api-key-dialog'
import type { AppAPIKey } from '@/types/api'
import { toast } from 'sonner'

export function AppConfigTab() {
  const { currentApp } = useAuthStore()
  const [apiKeys, setApiKeys] = useState<AppAPIKey[]>([])
  const [loading, setLoading] = useState(false)
  
  // 对话框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedApiKey, setSelectedApiKey] = useState<AppAPIKey | null>(null)
  


  // 加载API密钥列表
  useEffect(() => {
    if (currentApp) {
      loadApiKeys()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp])

  const loadApiKeys = async () => {
    if (!currentApp) return
    
    try {
      setLoading(true)
      const data = await AppService.getAPIKeys(currentApp.id)
      setApiKeys(data)
    } catch (error) {
      console.error('加载API密钥列表失败:', error)
      toast.error('加载API密钥列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 复制到剪贴板
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label}已复制到剪贴板`)
    } catch (_error) {
      toast.error('复制失败，请手动复制')
    }
  }





  // 处理删除API密钥
  const handleDeleteApiKey = (apiKey: AppAPIKey) => {
    setSelectedApiKey(apiKey)
    setDeleteDialogOpen(true)
  }

  // 处理创建成功
  const handleApiKeyCreated = () => {
    setCreateDialogOpen(false)
    loadApiKeys()
  }

  // 处理删除成功
  const handleApiKeyDeleted = () => {
    setDeleteDialogOpen(false)
    setSelectedApiKey(null)
    loadApiKeys()
  }

  if (!currentApp) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* 应用基础信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            应用基础信息
          </CardTitle>
          <CardDescription>
            SDK集成所需的基础参数信息
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="app-id">App ID</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="app-id"
                  value={currentApp.id.toString()}
                  readOnly
                  className="bg-muted"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(currentApp.id.toString(), 'App ID')}
                  title="复制App ID"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bundle-id">Bundle ID</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="bundle-id"
                  value={currentApp.package_name}
                  readOnly
                  className="bg-muted"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(currentApp.package_name, 'Bundle ID')}
                  title="复制Bundle ID"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API密钥管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              API 密钥管理
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              创建API密钥
            </Button>
          </CardTitle>
          <CardDescription>
            管理应用的API密钥，用于SDK认证
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              加载中...
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              暂无API密钥，请先创建一个
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>密钥名称</TableHead>
                  <TableHead>API密钥</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((apiKey) => {
                  return (
                    <TableRow key={apiKey.id}>
                      <TableCell className="font-medium">
                        {apiKey.name}
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                          {apiKey.key_prefix}****************{apiKey.key_suffix}
                        </code>
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
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">

                            <DropdownMenuItem
                              onClick={() => handleDeleteApiKey(apiKey)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除密钥
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 对话框组件 */}
      <CreateApiKeyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleApiKeyCreated}
      />
      
      <DeleteApiKeyDialog
        apiKey={selectedApiKey}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleApiKeyDeleted}
      />
    </div>
  )
}
