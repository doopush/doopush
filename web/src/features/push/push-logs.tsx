import { useEffect, useState } from 'react'
import { 
  History, 
 
  RefreshCw,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Send
} from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

import { useAuthStore } from '@/stores/auth-store'
import { PushService } from '@/services/push-service'
import { NoAppSelected } from '@/components/no-app-selected'
import { APP_SELECTION_DESCRIPTIONS } from '@/utils/app-utils'
import { PushLogDetailsDialog } from './components/push-log-details-dialog'
import type { PushLog } from '@/types/api'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export default function PushLogs() {
  const { currentApp } = useAuthStore()
  const [logs, setLogs] = useState<PushLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  
  // 对话框状态
  const [logDetailsOpen, setLogDetailsOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<PushLog | null>(null)
  
  // 分页状态
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  // 加载推送日志
  useEffect(() => {
    if (currentApp) {
      loadPushLogs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp, statusFilter, platformFilter, page])

  const loadPushLogs = async () => {
    if (!currentApp) return
    
    try {
      setLoading(true)
      const params = {
        page,
        page_size: pageSize,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(platformFilter !== 'all' && { platform: platformFilter }),
      }
      const data = await PushService.getPushLogs(currentApp.id, params)
      setLogs(data.logs)
      setTotal(data.total)
    } catch (error) {
      console.error('加载推送日志失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 筛选日志
  const filteredLogs = logs.filter((log) =>
    log.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.content.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleViewLog = (log: PushLog) => {
    setSelectedLog(log)
    setLogDetailsOpen(true)
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: { label: '已完成', className: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { label: '失败', className: 'bg-red-100 text-red-800', icon: XCircle },
      processing: { label: '发送中', className: 'bg-blue-100 text-blue-800', icon: Send },
      pending: { label: '待发送', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
    }
    return variants[status as keyof typeof variants] || variants.pending
  }

  const getSuccessRate = (log: PushLog) => {
    if (log.total_devices === 0) return '0%'
    return ((log.success_count / log.total_devices) * 100).toFixed(1) + '%'
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

      {!currentApp ? (
        <NoAppSelected 
          icon={<History className="h-16 w-16 text-muted-foreground" />}
          description={APP_SELECTION_DESCRIPTIONS.pushLogs}
        />
      ) : (
        <Main>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex flex-col gap-1'>
                <h1 className='text-2xl font-bold tracking-tight'>推送历史</h1>
                <p className='text-muted-foreground'>
                  查看应用 "{currentApp.name}" 的推送记录和统计
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <Button variant="outline" onClick={loadPushLogs}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </Button>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Button>
              </div>
            </div>

            {/* 筛选控件 */}
            <div className='flex items-center gap-4 mb-6'>
              <Input
                placeholder='搜索推送标题或内容...'
                className='h-9 w-full max-w-sm'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="processing">发送中</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="pending">待发送</SelectItem>
                </SelectContent>
              </Select>

              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部平台</SelectItem>
                  <SelectItem value="ios">iOS</SelectItem>
                  <SelectItem value="android">Android</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 推送日志表格 */}
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>推送信息</TableHead>
                    <TableHead>目标</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>成功率</TableHead>
                    <TableHead>发送时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    // 加载状态
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                          </div>
                        </TableCell>
                        <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-12 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-8 bg-muted rounded animate-pulse" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredLogs.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {searchTerm ? '未找到匹配的推送记录' : '暂无推送记录'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.title}</div>
                            <div className="text-sm text-muted-foreground truncate max-w-md">
                              {log.content}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {log.target_type === 'all' ? '全部设备' :
                               log.target_type === 'devices' ? '指定设备' :
                               log.target_type === 'tags' ? '标签筛选' :
                               log.target_type === 'groups' ? '分组推送' :
                               log.target_type}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {log.total_devices} 台
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusBadge(log.status).className}>
                              {getStatusBadge(log.status).label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium text-green-600">
                              {getSuccessRate(log)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {log.success_count}/{log.total_devices}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.sent_at 
                            ? formatDistanceToNow(new Date(log.sent_at), { 
                                addSuffix: true, 
                                locale: zhCN 
                              })
                            : '待发送'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* 分页控件 */}
            {total > pageSize && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  显示第 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 项，共 {total} 项
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * pageSize >= total}
                    onClick={() => setPage(page + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}

            {/* 推送详情对话框 */}
            {selectedLog && (
              <PushLogDetailsDialog
                log={selectedLog}
                open={logDetailsOpen}
                onOpenChange={setLogDetailsOpen}
              />
            )}
        </Main>
      )}
    </>
  )
}
