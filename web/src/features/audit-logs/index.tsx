import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker } from '@/components/date-time-picker'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { useAuthStore } from '@/stores/auth-store'
import { AuditService } from '@/services/audit-service'
import { NoAuthUser } from '@/components/no-auth-user'
import type { AuditLog } from '@/types/api'
import { Activity, Filter, RefreshCw, User, Calendar } from 'lucide-react'

export function AuditLogs() {
  const { isAuthenticated, currentApp } = useAuthStore()
  const [logs, setLogs] = useState<AuditLog[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    startTime: '',
    endTime: '',
  })

  useEffect(() => {
    if (isAuthenticated) {
      loadAuditLogs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp?.id, isAuthenticated])

  const loadAuditLogs = async () => {
    try {
      setIsLoading(true)
      const data = await AuditService.getGlobalAuditLogs(filters)
      setLogs(data.logs || [])
    } catch (error) {
      console.error('加载审计日志失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleSearch = () => {
    loadAuditLogs()
  }

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'create': return 'default'
      case 'update': return 'secondary'
      case 'delete': return 'destructive'
      case 'push': return 'outline'
      default: return 'secondary'
    }
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create: '创建',
      update: '更新',
      delete: '删除',
      push: '推送',
    }
    return labels[action] || action
  }

  const getResourceLabel = (resource: string) => {
    const labels: Record<string, string> = {
      app: '应用',
      device: '设备',
      push: '推送',
      config: '配置',
      template: '模板',
      group: '分组',
      scheduled_push: '定时推送',
    }
    return labels[resource] || resource
  }

  return (
    <>
      <Header>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {!isAuthenticated ? (
        <NoAuthUser icon={<Activity className="h-16 w-16 text-muted-foreground" />}
        />
      ) : (
        <Main>
        <div className='space-y-6'>
          <div className='flex flex-col gap-1'>
            <h1 className='text-2xl font-bold tracking-tight'>审计日志</h1>
            <p className='text-muted-foreground'>
              查看系统操作记录和安全审计信息
            </p>
          </div>

          {/* 筛选条件 */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Filter className='h-4 w-4' />
                筛选条件
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                <div className='space-y-2'>
                  <Label>操作类型</Label>
                  <Select value={filters.action || 'all'} onValueChange={(value) => handleFilterChange('action', value === 'all' ? '' : value)}>
                    <SelectTrigger className='w-full min-w-0'>
                      <SelectValue placeholder='选择操作类型' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>全部</SelectItem>
                      <SelectItem value='create'>创建</SelectItem>
                      <SelectItem value='update'>更新</SelectItem>
                      <SelectItem value='delete'>删除</SelectItem>
                      <SelectItem value='push'>推送</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label>资源类型</Label>
                  <Select value={filters.resource || 'all'} onValueChange={(value) => handleFilterChange('resource', value === 'all' ? '' : value)}>
                    <SelectTrigger className='w-full min-w-0'>
                      <SelectValue placeholder='选择资源类型' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>全部</SelectItem>
                      <SelectItem value='app'>应用</SelectItem>
                      <SelectItem value='device'>设备</SelectItem>
                      <SelectItem value='push'>推送</SelectItem>
                      <SelectItem value='config'>配置</SelectItem>
                      <SelectItem value='template'>模板</SelectItem>
                      <SelectItem value='group'>分组</SelectItem>
                      <SelectItem value='scheduled_push'>定时推送</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label>开始时间</Label>
                  <DateTimePicker
                    value={filters.startTime ? new Date(filters.startTime) : undefined}
                    onChange={(date: Date | undefined) => handleFilterChange('startTime', date ? date.toISOString() : '')}
                    placeholder="选择开始时间"
                  />
                </div>
                <div className='flex items-end space-y-2'>
                  <Button onClick={handleSearch} className='w-full'>
                    <RefreshCw className='h-4 w-4 mr-2' />
                    查询
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 日志列表 */}
          {isLoading ? (
            <Card>
              <CardContent className='p-6'>
                <div className='space-y-4'>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className='flex items-center gap-4 p-4 border rounded'>
                      <div className='h-8 w-8 animate-pulse rounded bg-muted' />
                      <div className='flex-1 space-y-2'>
                        <div className='h-4 w-48 animate-pulse rounded bg-muted' />
                        <div className='h-3 w-32 animate-pulse rounded bg-muted' />
                      </div>
                      <div className='h-6 w-16 animate-pulse rounded bg-muted' />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : !logs || logs.length === 0 ? (
            <Card>
              <CardContent className='flex h-40 items-center justify-center'>
                <div className='text-center text-muted-foreground py-8'>
                  暂无日志记录
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>操作记录</CardTitle>
                <CardDescription>
                  共 {logs?.length || 0} 条记录
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {logs?.map((log) => (
                    <div key={log.id} className='flex items-center gap-4 p-4 border rounded hover:bg-muted/50'>
                      <div className='flex-shrink-0'>
                        {log.action === 'push' ? (
                          <Activity className='h-5 w-5 text-blue-500' />
                        ) : (
                          <User className='h-5 w-5 text-muted-foreground' />
                        )}
                      </div>
                      <div className='flex-1 space-y-1'>
                        <div className='flex items-center gap-2'>
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {getActionLabel(log.action)}
                          </Badge>
                          <span className='text-sm font-medium'>
                            {getResourceLabel(log.resource)}
                          </span>
                          <span className='text-sm text-muted-foreground'>
                            #{log.resource_id}
                          </span>
                        </div>
                        <p className='text-sm text-muted-foreground'>
                          {log.details || '无详细信息'}
                        </p>
                        <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                          <span className='flex items-center gap-1'>
                            <User className='h-3 w-3' />
                            用户 #{log.user_id}
                          </span>
                          <span className='flex items-center gap-1'>
                            <Calendar className='h-3 w-3' />
                            {new Date(log.created_at).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        </Main>
      )}
    </>
  )
}
