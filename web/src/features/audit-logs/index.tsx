import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DateTimePicker } from '@/components/date-time-picker'
import { AuditStatistics } from './components/audit-statistics'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { useAuthStore } from '@/stores/auth-store'
import { AuditService } from '@/services/audit-service'
import { NoAuthUser } from '@/components/no-auth-user'
import type { AuditLogDTO } from '@/types/api'
import type { AuditLogQueryParams } from '@/services/audit-service'
import { Activity, Filter, RefreshCw, User, Calendar, Clock, Globe, Download, ChevronDown, ChevronUp, Eye, History, BarChart3, ShieldX } from 'lucide-react'
import { Pagination } from '@/components/pagination'

export function AuditLogs() {
  const { isAuthenticated, currentApp, hasAppPermission } = useAuthStore()
  const [logs, setLogs] = useState<AuditLogDTO[] | null>(null)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [selectedLog, setSelectedLog] = useState<AuditLogDTO | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('logs')
  const [isRefreshingStatistics, setIsRefreshingStatistics] = useState(false)
  const statisticsRef = useRef<{ refreshStatistics: () => Promise<void> } | null>(null)
  
  // 权限检查（仅应用级）
  const canViewAppLogs = currentApp ? hasAppPermission(currentApp.id, 'viewer') : false
  const hasAuditPermission = canViewAppLogs
  
  const [filters, setFilters] = useState<AuditLogQueryParams>({
    action: '',
    resource: '',
    start_time: '',
    end_time: '',
    user_name: '',
    ip_address: '',
    page: 1,
    page_size: pageSize,
  })

  useEffect(() => {
    if (isAuthenticated) {
      loadAuditLogs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp?.id, isAuthenticated, currentPage, pageSize])

  const loadAuditLogs = async () => {
    // 权限检查
    if (!hasAuditPermission) {
      setLogs([])
      setTotal(0)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const queryFilters = { ...filters, page: currentPage, page_size: pageSize }
      
      // 仅应用级数据
      let data
      if (currentApp && canViewAppLogs) {
        data = await AuditService.getAppAuditLogs(currentApp.id, queryFilters)
      } else {
        data = { logs: [], total: 0, page: 1, page_size: pageSize }
      }
      
      setLogs(data.logs || [])
      setTotal(data.total || 0)
      setCurrentPage(data.page || currentPage)
      setPageSize(data.page_size || pageSize)
      setTotalPages(Math.ceil((data.total || 0) / (data.page_size || pageSize)))
    } catch (error) {
      console.error('加载审计日志失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilterChange = (key: keyof AuditLogQueryParams, value: string | number) => {
    setFilters((prev: AuditLogQueryParams) => ({ ...prev, [key]: value }))
  }

  const handleSearch = () => {
    setCurrentPage(1)
    setFilters((prev: AuditLogQueryParams) => ({ ...prev, page: 1, page_size: pageSize }))
    loadAuditLogs()
  }

  const handleClearFilters = () => {
    setFilters({
      action: '',
      resource: '',
      start_time: '',
      end_time: '',
      user_name: '',
      ip_address: '',
      page: 1,
      page_size: pageSize,
    })
    setCurrentPage(1)
  }

  // 时间范围快速选择
  const setQuickTimeRange = (range: string) => {
    const now = new Date()
    const startTime = new Date()

    switch (range) {
      case 'today':
        startTime.setHours(0, 0, 0, 0)
        break
      case 'yesterday':
        startTime.setDate(now.getDate() - 1)
        startTime.setHours(0, 0, 0, 0)
        now.setDate(now.getDate() - 1)
        now.setHours(23, 59, 59, 999)
        break
      case 'week':
        startTime.setDate(now.getDate() - 7)
        break
      case 'month':
        startTime.setMonth(now.getMonth() - 1)
        break
      case 'clear':
        setFilters((prev: AuditLogQueryParams) => ({ ...prev, start_time: '', end_time: '' }))
        return
    }

    setFilters((prev: AuditLogQueryParams) => ({
      ...prev,
      start_time: startTime.toISOString(),
      end_time: range === 'clear' ? '' : now.toISOString()
    }))
  }

  // 导出审计日志
  const handleExport = async () => {
    if (!hasAuditPermission) {
      return
    }

    try {
      setIsExporting(true)

      // 构建导出过滤器（移除分页参数和空值）
      const exportFilters: Record<string, string | number | undefined> = {
        user_id: filters.user_id,
        action: filters.action,
        resource: filters.resource,
        user_name: filters.user_name,
        ip_address: filters.ip_address,
      }

      // 只在有值时才包含时间参数
      if (filters.start_time && filters.start_time.trim() !== '') {
        exportFilters.start_time = filters.start_time
      }
      if (filters.end_time && filters.end_time.trim() !== '') {
        exportFilters.end_time = filters.end_time
      }

      let result
      if (currentApp && canViewAppLogs) {
        // 导出应用审计日志
        result = await AuditService.exportAppAuditLogs(currentApp.id, exportFilters)
      } else {
        throw new Error('没有导出权限')
      }

      // 开始下载
      await AuditService.downloadExportFile(result.download_url, result.filename)
    } catch (error) {
      console.error('导出审计日志失败:', error)
      // 这里可以添加错误提示
    } finally {
      setIsExporting(false)
    }
  }

  // 统计组件的 dateRange，使用 useMemo 防止不必要的重新渲染
  const statisticsDateRange = useMemo(() => ({
    start_time: filters.start_time,
    end_time: filters.end_time
  }), [filters.start_time, filters.end_time])

  // 刷新统计数据
  const handleRefreshStatistics = async () => {
    if (!hasAuditPermission) {
      return
    }

    try {
      setIsRefreshingStatistics(true)
      if (statisticsRef.current) {
        await statisticsRef.current.refreshStatistics()
      }
    } catch (error) {
      console.error('刷新统计数据失败:', error)
    } finally {
      setIsRefreshingStatistics(false)
    }
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

  // 相对时间计算
  const getRelativeTime = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return '刚刚'
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes}分钟前`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours}小时前`
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days}天前`
    } else {
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    }
  }

  // 显示日志详情
  const showLogDetails = (log: AuditLogDTO) => {
    setSelectedLog(log)
    setIsDetailDialogOpen(true)
  }

  // 格式化JSON数据
  const formatJsonData = (data: string | undefined | null) => {
    if (!data) return null
    try {
      const parsed = JSON.parse(data)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return data
    }
  }

  const getActionLabel = (log: AuditLogDTO) => {
    // 优先使用后端返回的友好标签
    if (log.action_label) return log.action_label
    
    // 回退到本地标签映射
    const labels: Record<string, string> = {
      create: '创建',
      update: '更新',
      delete: '删除',
      push: '推送',
    }
    return labels[log.action] || log.action
  }

  const getResourceLabel = (log: AuditLogDTO) => {
    // 优先使用后端返回的友好标签
    if (log.resource_label) return log.resource_label
    
    // 回退到本地标签映射
    const labels: Record<string, string> = {
      app: '应用',
      device: '设备',
      push: '推送',
      config: '配置',
      template: '模板',
      group: '分组',
      api_key: 'API密钥',
      scheduled_push: '定时推送',
    }
    return labels[log.resource] || log.resource
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
      ) : !hasAuditPermission ? (
        <Main>
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <ShieldX className="h-16 w-16 text-muted-foreground" />
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">权限不足</h2>
              <p className="text-muted-foreground max-w-md">
                {!currentApp 
                  ? "您需要选择一个应用才能查看审计日志。"
                  : "您没有权限查看该应用的审计日志，请联系应用管理员授权。"
                }
              </p>
            </div>
          </div>
        </Main>
      ) : (
        <Main>
        <div className='space-y-6'>
          <div className='flex items-center justify-between mb-6 gap-4'>
            <div className='flex flex-col gap-1'>
              <h1 className='text-2xl font-bold tracking-tight'>审计日志</h1>
              <p className='text-muted-foreground'>
                {currentApp
                  ? `查看 "${currentApp.name}" 应用的操作记录和安全审计信息`
                  : "请先选择一个应用来查看审计日志"
                }
              </p>
            </div>
            <div className='flex items-center gap-2'>
              {activeTab === 'logs' && (
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                  ) : (
                    <Download className='h-4 w-4 mr-2' />
                  )}
                  {isExporting ? '导出中...' : '导出'}
                </Button>
              )}
              {activeTab === 'statistics' && (
                <Button
                  variant="outline"
                  onClick={handleRefreshStatistics}
                  disabled={isRefreshingStatistics}
                >
                  {isRefreshingStatistics ? (
                    <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                  ) : (
                    <RefreshCw className='h-4 w-4 mr-2' />
                  )}
                  {isRefreshingStatistics ? '刷新中...' : '刷新统计数据'}
                </Button>
              )}
            </div>
          </div>

          <Tabs defaultValue="logs" className="space-y-4" onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="logs" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                操作日志
              </TabsTrigger>
              <TabsTrigger value="statistics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                数据统计
              </TabsTrigger>
            </TabsList>
          <TabsContent value="logs" className="space-y-6">
          {/* 筛选条件 */}
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle className='flex items-center gap-2'>
                  <Filter className='h-4 w-4' />
                  筛选条件
                </CardTitle>
                <div className='flex items-center gap-2'>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                  >
                    {isFiltersExpanded ? (
                      <ChevronUp className='h-4 w-4' />
                    ) : (
                      <ChevronDown className='h-4 w-4' />
                    )}
                    {isFiltersExpanded ? '收起' : '展开'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 基础筛选条件 */}
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
                      <SelectItem value='api_key'>API密钥</SelectItem>
                      <SelectItem value='scheduled_push'>定时推送</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label>用户名</Label>
                  <Input
                    placeholder="输入用户名"
                    value={filters.user_name || ''}
                    onChange={(e) => handleFilterChange('user_name', e.target.value)}
                  />
                </div>
                <div className='flex items-end'>
                  <Button onClick={handleSearch} className='w-full'>
                    <RefreshCw className='h-4 w-4 mr-2' />
                    查询
                  </Button>
                </div>
              </div>

              {/* 高级筛选条件 */}
              {isFiltersExpanded && (
                <div className='mt-6 space-y-4'>
                  <div className='border-t pt-4'>
                    <h4 className='text-sm font-medium mb-3'>高级筛选</h4>
                    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                      <div className='space-y-2'>
                        <Label>IP地址</Label>
                        <Input
                          placeholder="输入IP地址"
                          value={filters.ip_address || ''}
                          onChange={(e) => handleFilterChange('ip_address', e.target.value)}
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label>开始时间</Label>
                        <DateTimePicker
                          value={filters.start_time ? new Date(filters.start_time) : undefined}
                          onChange={(date: Date | undefined) => handleFilterChange('start_time', date ? date.toISOString() : '')}
                          placeholder="选择开始时间"
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label>结束时间</Label>
                        <DateTimePicker
                          value={filters.end_time ? new Date(filters.end_time) : undefined}
                          onChange={(date: Date | undefined) => handleFilterChange('end_time', date ? date.toISOString() : '')}
                          placeholder="选择结束时间"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 时间范围快速选择 */}
                  <div className='border-t pt-4'>
                    <h4 className='text-sm font-medium mb-3 flex items-center gap-2'>
                      <Clock className='h-4 w-4' />
                      时间范围快速选择
                    </h4>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickTimeRange('today')}
                      >
                        今天
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickTimeRange('yesterday')}
                      >
                        昨天
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickTimeRange('week')}
                      >
                        最近7天
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickTimeRange('month')}
                      >
                        最近30天
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickTimeRange('clear')}
                      >
                        清除时间
                      </Button>
                    </div>
                  </div>

                  {/* 筛选操作 */}
                  <div className='border-t pt-4'>
                    <div className='flex gap-2'>
                      <Button variant="outline" onClick={handleClearFilters}>
                        清除全部筛选
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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
                  共 {total} 条记录，当前显示 {logs?.length || 0} 条
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {logs?.map((log) => (
                    <div key={log.id} className='flex items-start gap-4 p-4 border rounded hover:bg-muted/50'>
                      <div className='flex-shrink-0 mt-1'>
                        {log.action === 'push' ? (
                          <Activity className='h-5 w-5 text-blue-500' />
                        ) : (
                          <User className='h-5 w-5 text-muted-foreground' />
                        )}
                      </div>
                      <div className='flex-1 space-y-2'>
                        {/* 主要信息 */}
                        <div className='flex items-center gap-2 flex-wrap'>
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {getActionLabel(log)}
                          </Badge>
                          <span className='text-sm font-medium'>
                            {getResourceLabel(log)}
                          </span>
                          <span className='text-sm text-muted-foreground'>
                            #{log.resource_id}
                          </span>
                        </div>

                        {/* 详细信息 */}
                        {log.details && (
                          <p className='text-sm text-muted-foreground'>
                            {log.details}
                          </p>
                        )}

                        {/* 元数据信息 */}
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center gap-4 text-xs text-muted-foreground flex-wrap'>
                            <span className='flex items-center gap-1'>
                              <User className='h-3 w-3' />
                              {log.user_name || `用户#${log.user_id}`}
                            </span>
                            <span className='flex items-center gap-1'>
                              <Globe className='h-3 w-3' />
                              {log.ip_address}
                            </span>
                            <span className='flex items-center gap-1'>
                              <History className='h-3 w-3' />
                              {getRelativeTime(log.created_at)}
                            </span>
                            <span className='flex items-center gap-1' title={new Date(log.created_at).toLocaleString('zh-CN')}>
                              <Calendar className='h-3 w-3' />
                              {new Date(log.created_at).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => showLogDetails(log)}
                            className='text-xs'
                          >
                            <Eye className='h-3 w-3 mr-1' />
                            详情
                          </Button>
                        </div>

                        {/* 变更数据展示 */}
                        {(log.before_data || log.after_data) && (
                          <div className='mt-2 p-2 bg-muted/30 rounded text-xs'>
                            <div className='font-medium mb-1'>数据变更:</div>
                            <div className='space-y-1'>
                              {log.before_data && (
                                <div>
                                  <span className='text-red-600'>变更前:</span>
                                  <span className='ml-2 font-mono'>
                                    {typeof log.before_data === 'string' 
                                      ? log.before_data.length > 100 
                                        ? log.before_data.substring(0, 100) + '...'
                                        : log.before_data
                                      : JSON.stringify(log.before_data)
                                    }
                                  </span>
                                </div>
                              )}
                              {log.after_data && (
                                <div>
                                  <span className='text-green-600'>变更后:</span>
                                  <span className='ml-2 font-mono'>
                                    {typeof log.after_data === 'string' 
                                      ? log.after_data.length > 100 
                                        ? log.after_data.substring(0, 100) + '...'
                                        : log.after_data
                                      : JSON.stringify(log.after_data)
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 分页控件 */}
          {logs && logs.length > 0 && (
            <Pagination
              className='mt-4'
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
            </TabsContent>

            <TabsContent value="statistics" className="space-y-6">
              <AuditStatistics
                ref={statisticsRef}
                dateRange={statisticsDateRange}
              />
            </TabsContent>
          </Tabs>
        </div>
        </Main>
      )}

      {/* 操作详情弹窗 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Activity className='h-5 w-5' />
              操作详情 #{selectedLog?.id}
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="flex-1 overflow-auto -mx-6 px-6">
              <div className='space-y-6'>
                {/* 基本信息 */}
                <div className='grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded'>
                  <div>
                    <Label className='text-xs font-medium text-muted-foreground'>操作类型</Label>
                    <div className='mt-1'>
                      <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                        {getActionLabel(selectedLog)}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className='text-xs font-medium text-muted-foreground'>资源类型</Label>
                    <div className='mt-1 font-medium'>
                      {getResourceLabel(selectedLog)}
                    </div>
                  </div>
                  <div>
                    <Label className='text-xs font-medium text-muted-foreground'>资源ID</Label>
                    <div className='mt-1 font-mono'>
                      #{selectedLog.resource_id}
                    </div>
                  </div>
                  <div>
                    <Label className='text-xs font-medium text-muted-foreground'>操作用户</Label>
                    <div className='mt-1'>
                      {selectedLog.user_name || `用户#${selectedLog.user_id}`}
                    </div>
                  </div>
                  <div>
                    <Label className='text-xs font-medium text-muted-foreground'>IP地址</Label>
                    <div className='mt-1 font-mono'>
                      {selectedLog.ip_address}
                    </div>
                  </div>
                  <div>
                    <Label className='text-xs font-medium text-muted-foreground'>操作时间</Label>
                    <div className='mt-1'>
                      <div>{getRelativeTime(selectedLog.created_at)}</div>
                      <div className='text-xs text-muted-foreground'>
                        {new Date(selectedLog.created_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                  {selectedLog.app_name && (
                    <div>
                      <Label className='text-xs font-medium text-muted-foreground'>应用</Label>
                      <div className='mt-1'>
                        <Badge variant="outline">{selectedLog.app_name}</Badge>
                      </div>
                    </div>
                  )}
                </div>

                {/* 操作详情 */}
                {selectedLog.details && (
                  <div>
                    <h4 className='font-medium mb-2'>操作详情</h4>
                    <div className='p-3 bg-muted/30 rounded font-mono text-sm overflow-x-auto'>
                      {selectedLog.details}
                    </div>
                  </div>
                )}

                {/* User Agent信息 */}
                {selectedLog.user_agent && (
                  <div>
                    <h4 className='font-medium mb-2'>用户代理</h4>
                    <div className='p-3 bg-muted/30 rounded font-mono text-xs break-all'>
                      {selectedLog.user_agent}
                    </div>
                  </div>
                )}

                {/* 变更前后数据对比 */}
                {(selectedLog.before_data || selectedLog.after_data) && (
                  <div>
                    <h4 className='font-medium mb-2'>数据变更对比</h4>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      <div className="flex flex-col">
                        <Label className='text-sm font-medium text-red-600 mb-2 block'>
                          变更前数据
                        </Label>
                        <div className='min-h-0 flex-1 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded'>
                          {selectedLog.before_data ? (
                            <pre className='min-h-full text-xs whitespace-pre-wrap font-mono overflow-x-auto'>
                              {formatJsonData(selectedLog.before_data)}
                            </pre>
                          ) : (
                            <div className='min-h-full text-xs whitespace-pre-wrap font-mono overflow-x-auto'>
                              <span className='text-red-600'>-</span>                             
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <Label className='text-sm font-medium text-green-600 mb-2 block'>
                          变更后数据
                        </Label>
                        <div className='min-h-0 flex-1 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded'>
                        {selectedLog.after_data ? (
                          <pre className='min-h-full text-xs whitespace-pre-wrap font-mono overflow-x-auto'>
                            {formatJsonData(selectedLog.after_data)}
                          </pre>
                        ) : (
                          <div className='min-h-full text-xs whitespace-pre-wrap font-mono overflow-x-auto'>
                            <span className='text-green-600'>-</span>
                          </div>
                        )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
