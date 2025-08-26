import { useEffect, useState } from 'react'
import { Plus, Package, Edit, Trash2, Key, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { PlatformIndicatorIcon } from '@/components/platform-icon'

import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'


import { AppService } from '@/services/app-service'
import { useAuthStore } from '@/stores/auth-store'
import { NoAuthUser } from '@/components/no-auth-user'
import { getIconURL } from '@/utils/app-utils'
import { CreateAppDialog } from './components/create-app-dialog'
import { EditAppDialog } from './components/edit-app-dialog'
import { DeleteAppDialog } from './components/delete-app-dialog'
import { APIKeysDialog } from './components/api-keys-dialog'
import type { App } from '@/types/api'

export function Apps() {
  const { isAuthenticated } = useAuthStore()
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // 对话框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [apiKeysDialogOpen, setAPIKeysDialogOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<App | null>(null)

  // 加载应用列表
  useEffect(() => {
    if (isAuthenticated) {
      loadApps()
    }
  }, [isAuthenticated])

  const loadApps = async () => {
    try {
      setLoading(true)
      const apps = await AppService.getApps()
      setApps(apps || [])
    } catch (error) {
      console.error('加载应用列表失败:', error)
      setApps([]) // 确保apps始终是数组
    } finally {
      setLoading(false)
    }
  }

  // 筛选应用
  const filteredApps = apps.filter((app) =>
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.package_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 操作处理
  const handleEditApp = (app: App) => {
    setSelectedApp(app)
    setEditDialogOpen(true)
  }

  const handleDeleteApp = (app: App) => {
    setSelectedApp(app)
    setDeleteDialogOpen(true)
  }

  const handleManageAPIKeys = (app: App) => {
    setSelectedApp(app)
    setAPIKeysDialogOpen(true)
  }

  const handleAppCreated = async () => {
    setCreateDialogOpen(false)
    await loadApps()
    
    // 同时更新sidebar的应用列表（包括禁用的应用）
    try {
      const { setUserApps, setCurrentApp } = useAuthStore.getState()
      const allApps = await AppService.getApps()
      setUserApps(allApps)
      
      // 自动选择新创建的应用（通常是最新的）
      if (allApps.length > 0) {
        const latestApp = allApps[allApps.length - 1]
        setCurrentApp(latestApp)
      }
    } catch (error) {
      console.error('更新sidebar应用列表失败:', error)
    }
  }

  const handleAppUpdated = async () => {
    setEditDialogOpen(false)
    setSelectedApp(null)
    await loadApps()
    
    // 同时更新sidebar的应用列表（包括禁用的应用）
    try {
      const { setUserApps } = useAuthStore.getState()
      const allApps = await AppService.getApps()
      setUserApps(allApps)
    } catch (error) {
      console.error('更新sidebar应用列表失败:', error)
    }
  }

  const handleAppDeleted = async () => {
    setDeleteDialogOpen(false)
    setSelectedApp(null)
    await loadApps()
    
    // 同时更新sidebar的应用列表（包括禁用的应用）
    try {
      const { setUserApps, setCurrentApp } = useAuthStore.getState()
      const allApps = await AppService.getApps()
      setUserApps(allApps)
      
      // 如果删除的是当前应用，清除当前应用
      if (selectedApp && useAuthStore.getState().currentApp?.id === selectedApp.id) {
        setCurrentApp(null)
      }
    } catch (error) {
      console.error('更新sidebar应用列表失败:', error)
    }
  }

  return (
    <>
      <Header>
        <Search />
        <div className='ms-auto flex items-center gap-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {!isAuthenticated ? (
        <NoAuthUser icon={<Package className="h-16 w-16 text-muted-foreground" />} />
      ) : (
        <Main>
        <div className='flex items-center justify-between'>
          <div className='flex flex-col gap-1'>
            <h1 className='text-2xl font-bold tracking-tight'>应用管理</h1>
            <p className='text-muted-foreground'>
              管理您的推送应用，配置推送服务和API密钥
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            创建应用
          </Button>
        </div>

        <div className='my-4 flex items-center gap-4'>
          <Input
            placeholder='搜索应用名称或包名...'
            className='h-9 w-full max-w-sm'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>应用信息</TableHead>
                <TableHead className="text-center">平台</TableHead>
                <TableHead className="text-center">状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // 加载状态
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
                        <div className="space-y-2">
                          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                          <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-12 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-8 bg-muted rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : filteredApps.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {searchTerm ? '未找到匹配的应用' : '暂无应用'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredApps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden">
                          {app.app_icon ? (
                            <img 
                              src={getIconURL(app.app_icon)} 
                              alt={app.name} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{app.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {app.package_name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell align='center'>
                      {PlatformIndicatorIcon(app.platform)}
                    </TableCell>
                    <TableCell align='center'>
                      <Badge className={app.status === 1 ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-red-100 text-red-800 hover:bg-red-100'}>
                        {app.status === 1 ? '启用' : '禁用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(app.created_at).toLocaleString('zh-CN', {
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
                          <DropdownMenuItem onClick={() => handleEditApp(app)}>
                            <Edit className="mr-2 h-4 w-4" />
                            编辑应用
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleManageAPIKeys(app)}>
                            <Key className="mr-2 h-4 w-4" />
                            API密钥
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteApp(app)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除应用
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 对话框组件 */}
        <CreateAppDialog 
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={handleAppCreated}
        />
        
        {selectedApp && (
          <>
            <EditAppDialog
              app={selectedApp}
              open={editDialogOpen}
              onOpenChange={setEditDialogOpen}
              onSuccess={handleAppUpdated}
            />
            
            <DeleteAppDialog
              app={selectedApp}
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              onSuccess={handleAppDeleted}
            />
            
            <APIKeysDialog
              app={selectedApp}
              open={apiKeysDialogOpen}
              onOpenChange={setAPIKeysDialogOpen}
            />
          </>
        )}
        </Main>
      )}
    </>
  )
}
