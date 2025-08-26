import { useState, useEffect, useCallback } from 'react'
import { Search as SearchIcon, Plus, Clock, Play, Pause, Trash2, MoreHorizontal, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth-store'
import { ScheduledPushService } from '@/services/scheduled-push-service'
import { NoAppSelected } from '@/components/no-app-selected'
import { APP_SELECTION_DESCRIPTIONS } from '@/utils/app-utils'
import { CreateScheduledPushDialog } from './components/create-scheduled-push-dialog'
import { EditScheduledPushDialog } from './components/edit-scheduled-push-dialog'
import { DeleteScheduledPushDialog } from './components/delete-scheduled-push-dialog'
import { toast } from 'sonner'
import type { ScheduledPush } from '@/types/api'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'

export function ScheduledPush() {
  const { currentApp } = useAuthStore()
  const [scheduledPushes, setScheduledPushes] = useState<ScheduledPush[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [repeatFilter, setRepeatFilter] = useState<string>('all')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  })

  // 对话框状态
  const [createOpen, setCreateOpen] = useState(false)
  const [editPush, setEditPush] = useState<ScheduledPush | null>(null)
  const [deletePush, setDeletePush] = useState<ScheduledPush | null>(null)

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
  })

  const fetchScheduledPushes = useCallback(async () => {
    if (!currentApp) return

    try {
      setLoading(true)
      const response = await ScheduledPushService.getScheduledPushes(currentApp.id, {
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        repeat_type: repeatFilter === 'all' ? undefined : repeatFilter,
      })

      setScheduledPushes(response.data || [])
      
      // 安全检查分页信息
      const paginationInfo = response.pagination || {
        page: pagination.page,
        limit: pagination.limit,
        total: 0
      }
      
      setPagination({
        page: paginationInfo.page,
        limit: paginationInfo.limit,
        total: paginationInfo.total,
      })

      // 计算统计数据
      const items = response.data || []
      setStats({
        total: paginationInfo.total,
        pending: items.filter((p: ScheduledPush) => p.status === 'pending').length,
        running: items.filter((p: ScheduledPush) => p.status === 'running').length,
        completed: items.filter((p: ScheduledPush) => p.status === 'completed').length,
      })
    } catch (error) {
      toast.error((error as Error).message || '获取定时推送列表失败')
    } finally {
      setLoading(false)
    }
  }, [currentApp, pagination.page, pagination.limit, search, statusFilter, repeatFilter])

  useEffect(() => {
    if (currentApp) {
      fetchScheduledPushes()
    }
  }, [currentApp, fetchScheduledPushes])

  const handlePause = async (push: ScheduledPush) => {
    if (!currentApp) return

    try {
      await ScheduledPushService.pauseScheduledPush(currentApp.id, push.id)
      toast.success('定时推送已暂停')
      fetchScheduledPushes()
    } catch (error) {
      toast.error((error as Error).message || '暂停定时推送失败')
    }
  }

  const handleResume = async (push: ScheduledPush) => {
    if (!currentApp) return

    try {
      await ScheduledPushService.resumeScheduledPush(currentApp.id, push.id)
      toast.success('定时推送已恢复')
      fetchScheduledPushes()
    } catch (error) {
      toast.error((error as Error).message || '恢复定时推送失败')
    }
  }

  const handleExecuteNow = async (push: ScheduledPush) => {
    if (!currentApp) return

    try {
      await ScheduledPushService.executeScheduledPush(currentApp.id, push.id)
      toast.success('定时推送已立即执行')
      fetchScheduledPushes()
    } catch (error) {
      toast.error((error as Error).message || '执行定时推送失败')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: 'secondary' as const, label: '等待中', color: 'text-yellow-600' },
      running: { variant: 'default' as const, label: '运行中', color: 'text-blue-600' },
      paused: { variant: 'outline' as const, label: '已暂停', color: 'text-gray-600' },
      completed: { variant: 'secondary' as const, label: '已完成', color: 'text-green-600' },
      failed: { variant: 'destructive' as const, label: '失败', color: 'text-white' },
    }
    const config = variants[status as keyof typeof variants] || variants.pending
    return <Badge variant={config.variant} className={config.color}>{config.label}</Badge>
  }

  const getRepeatLabel = (repeatType: string) => {
    const labels = {
      none: '单次',
      daily: '每日',
      weekly: '每周',
      monthly: '每月',
    }
    return labels[repeatType as keyof typeof labels] || repeatType
  }

  if (!currentApp) {
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

        <NoAppSelected 
          icon={<Clock className="h-16 w-16 text-muted-foreground" />}
          description={APP_SELECTION_DESCRIPTIONS.scheduledPush}
        />
      </>
    )
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

      <Main>
        <div className='flex items-center justify-between mb-6'>
          <div className='flex flex-col gap-1'>
            <h1 className='text-2xl font-bold tracking-tight'>定时推送</h1>
            <p className='text-muted-foreground'>
              管理应用 "{currentApp.name}" 的定时推送任务
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            创建任务
          </Button>
        </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总任务数</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">等待执行</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">运行中</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已完成</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between my-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索推送标题或内容"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[300px]"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有状态</SelectItem>
              <SelectItem value="pending">等待中</SelectItem>
              <SelectItem value="running">运行中</SelectItem>
              <SelectItem value="paused">已暂停</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
            </SelectContent>
          </Select>

          <Select value={repeatFilter} onValueChange={setRepeatFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="重复" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有类型</SelectItem>
              <SelectItem value="none">单次</SelectItem>
              <SelectItem value="daily">每日</SelectItem>
              <SelectItem value="weekly">每周</SelectItem>
              <SelectItem value="monthly">每月</SelectItem>
            </SelectContent>
          </Select>
        </div>


      </div>

      {/* 定时推送列表表格 */}
      <Card>
        <CardHeader>
          <CardTitle>定时推送列表</CardTitle>
          <CardDescription>
            管理所有定时推送任务
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>推送信息</TableHead>
                <TableHead>执行时间</TableHead>
                <TableHead>重复类型</TableHead>
                <TableHead>推送目标</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : scheduledPushes.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    暂无定时推送任务
                  </TableCell>
                </TableRow>
              ) : (
                scheduledPushes.map((push) => (
                  <TableRow key={push.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{push.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {push.content}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(push.scheduled_at).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      {push.timezone && (
                        <div className="text-xs text-muted-foreground">
                          {push.timezone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getRepeatLabel(push.repeat_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {push.push_type === 'single' ? '单设备' : 
                         push.push_type === 'batch' ? '批量推送' : '广播推送'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(push.status)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(push.created_at).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {push.status === 'pending' && (
                            <DropdownMenuItem onClick={() => handleExecuteNow(push)}>
                              <Play className="mr-2 h-4 w-4" />
                              立即执行
                            </DropdownMenuItem>
                          )}
                          
                          {push.status === 'running' && (
                            <DropdownMenuItem onClick={() => handlePause(push)}>
                              <Pause className="mr-2 h-4 w-4" />
                              暂停任务
                            </DropdownMenuItem>
                          )}
                          
                          {push.status === 'paused' && (
                            <DropdownMenuItem onClick={() => handleResume(push)}>
                              <Play className="mr-2 h-4 w-4" />
                              恢复任务
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem onClick={() => setEditPush(push)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            编辑任务
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeletePush(push)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除任务
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 分页控制 */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                显示 {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} - {Math.min(pagination.page * pagination.limit, pagination.total)} 条，
                共 {pagination.total} 条
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page <= 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page * pagination.limit >= pagination.total}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

        {/* 对话框组件 */}
        <CreateScheduledPushDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={fetchScheduledPushes}
        />

        {editPush && (
          <EditScheduledPushDialog
            push={editPush}
            open={!!editPush}
            onOpenChange={(open) => !open && setEditPush(null)}
            onSuccess={fetchScheduledPushes}
          />
        )}

        {deletePush && (
          <DeleteScheduledPushDialog
            push={deletePush}
            open={!!deletePush}
            onOpenChange={(open) => !open && setDeletePush(null)}
            onSuccess={fetchScheduledPushes}
          />
        )}
      </Main>
    </>
  )
}
