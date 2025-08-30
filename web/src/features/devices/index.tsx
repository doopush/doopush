import { useEffect, useState } from 'react'
import { 
  Smartphone, 
  MoreHorizontal, 
  Eye, 
  Power,
  PowerOff,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

import { useAuthStore } from '@/stores/auth-store'
import { DeviceService } from '@/services/device-service'
import { DeviceDetailsDialog } from './components/device-details-dialog'
import { NoAppSelected } from '@/components/no-app-selected'
import { APP_SELECTION_DESCRIPTIONS } from '@/utils/app-utils'
import { Apple, Android } from '@/components/platform-icon'
import { ConfirmDialog } from '@/components/confirm-dialog'
import type { Device } from '@/types/api'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Pagination } from '@/components/pagination'

export function Devices() {
  const { currentApp } = useAuthStore()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // 对话框状态
  const [deviceDetailsOpen, setDeviceDetailsOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // 统计数据
  const [deviceStats, setDeviceStats] = useState({
    total: 0,
    ios: 0,
    android: 0,
    active: 0,
  })

  // 分页（统一）
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // 加载设备列表
  useEffect(() => {
    if (currentApp) {
      loadDevices()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp, platformFilter, statusFilter, currentPage, pageSize])

  const loadDevices = async () => {
    if (!currentApp) return
    
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        page_size: pageSize,
        ...(platformFilter !== 'all' && { platform: platformFilter }),
        ...(statusFilter !== 'all' && { status: parseInt(statusFilter) }),
      }
      const resp = await DeviceService.getDevices(currentApp.id, params)
      setDevices(resp.data.items)
      setCurrentPage(resp.current_page)
      setPageSize(resp.page_size)
      setTotalItems(resp.total_items)
      setTotalPages(resp.total_pages)

      // 计算统计数据（当前页）
      const stats = {
        total: resp.data.items.length,
        ios: resp.data.items.filter(d => d.platform === 'ios').length,
        android: resp.data.items.filter(d => d.platform === 'android').length,
        active: resp.data.items.filter(d => d.status === 1).length,
      }
      setDeviceStats(stats)
    } catch (error) {
      console.error('加载设备列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 筛选设备（前端再过滤一次，仅作用于当前页显示）
  const filteredDevices = devices.filter((device) =>
    device.token.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.user_agent.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.model.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 操作处理
  const handleViewDevice = (device: Device) => {
    setSelectedDevice(device)
    setDeviceDetailsOpen(true)
  }

  const handleToggleDeviceStatus = async (device: Device) => {
    try {
      const newStatus = device.status === 1 ? 0 : 1
      await DeviceService.updateDeviceStatus(currentApp!.id, device.token, newStatus)
      loadDevices()
      toast.success(`设备已${newStatus === 1 ? '启用' : '禁用'}`)
    } catch (error) {
      toast.error((error as Error).message || '更新设备状态失败')
    }
  }

  const handleDeleteDevice = (device: Device) => {
    setDeviceToDelete(device)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deviceToDelete) return
    
    try {
      setIsDeleting(true)
      await DeviceService.deleteDevice(currentApp!.id, deviceToDelete.token)
      loadDevices()
      toast.success('设备删除成功')
      setDeleteConfirmOpen(false)
      setDeviceToDelete(null)
    } catch (error) {
      toast.error((error as Error).message || '删除设备失败')
    } finally {
      setIsDeleting(false)
    }
  }

  const getPlatformBadge = (platform: string) => {
    const variants = {
      ios: 'bg-blue-100 text-blue-800',
      android: 'bg-green-100 text-green-800',
    }
    return variants[platform as keyof typeof variants] || 'bg-gray-100 text-gray-800'
  }

  const getStatusBadge = (status: number) => {
    return status === 1 
      ? { label: '启用', className: 'bg-green-100 text-green-800' }
      : { label: '禁用', className: 'bg-red-100 text-red-800' }
  }

  const getBrandIcon = (platform: string, brand: string) => {
    if (platform === 'ios') return <Apple className="h-5 w-5" />
    
    // Android 平台根据品牌返回相应图标
    const brandIcons: Record<string, React.ReactNode> = {
      huawei: <Android className="h-5 w-5" />,
      xiaomi: <Android className="h-5 w-5" />,
      oppo: <Android className="h-5 w-5" />,
      vivo: <Android className="h-5 w-5" />,
      samsung: <Android className="h-5 w-5" />,
      google: <Android className="h-5 w-5" />,
      apple: <Apple className="h-5 w-5" />,
    }
    return brandIcons[brand.toLowerCase()] || <Android className="h-5 w-5" />
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
          icon={<Smartphone className="h-16 w-16 text-muted-foreground" />}
          description={APP_SELECTION_DESCRIPTIONS.devices}
        />
      ) : (
        <Main>
            <div className='flex items-center justify-between gap-4'>
              <div className='flex flex-col gap-1'>
                <h1 className='text-2xl font-bold tracking-tight'>设备管理</h1>
                <p className='text-muted-foreground'>
                  管理应用 "{currentApp.name}" 的所有注册设备
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <Button variant="outline" onClick={loadDevices}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </Button>
              </div>
            </div>

            {/* 统计卡片 */}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 my-6'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>当前页设备数</CardTitle>
                  <Smartphone className='text-muted-foreground h-4 w-4' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {loading ? '...' : deviceStats.total.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>iOS设备</CardTitle>
                  <Apple className='h-5 w-5 text-blue-600' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-blue-600'>
                    {loading ? '...' : deviceStats.ios.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Android设备</CardTitle>
                  <Android className='h-5 w-5 text-green-600' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-green-600'>
                    {loading ? '...' : deviceStats.android.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>在线设备</CardTitle>
                  <Power className='text-muted-foreground h-4 w-4' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-green-600'>
                    {loading ? '...' : deviceStats.active.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 筛选控件 */}
            <div className='flex items-center gap-4 mb-4'>
              <Input
                placeholder='搜索设备Token、用户代理或设备型号...'
                className='h-9 w-full max-w-sm'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              
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

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="1">在线</SelectItem>
                  <SelectItem value="0">离线</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 设备列表表格 */}
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备信息</TableHead>
                    <TableHead>用户代理</TableHead>
                    <TableHead>平台</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>最后活跃</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    // 加载状态
                    Array.from({ length: 10 }).map((_, i) => (
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
                        <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-12 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-8 bg-muted rounded animate-pulse" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredDevices.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {searchTerm ? '未找到匹配的设备' : '暂无设备数据'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDevices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                              {getBrandIcon(device.platform, device.brand)}
                            </div>
                            <div>
                              <div className="font-medium">{device.model}</div>
                              <div className="text-sm text-muted-foreground font-mono">
                                {device.token.length > 20 
                                  ? `${device.token.slice(0, 20)}...`
                                  : device.token
                                }
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {device.app_version} • {device.system_version}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {device.user_agent.length > 50 
                              ? `${device.user_agent.slice(0, 50)}...`
                              : device.user_agent
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={getPlatformBadge(device.platform)}>
                              {device.platform.toUpperCase()}
                            </Badge>
                            {device.platform === 'android' && device.brand && (
                              <Badge variant="outline" className="text-xs">
                                {device.brand}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(device.status).className}>
                            {getStatusBadge(device.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {device.last_seen ? formatDistanceToNow(new Date(device.last_seen), { 
                            addSuffix: true, 
                            locale: zhCN 
                          }) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDevice(device)}>
                                <Eye className="mr-2 h-4 w-4" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleDeviceStatus(device)}>
                                {device.status === 1 ? (
                                  <>
                                    <PowerOff className="mr-2 h-4 w-4" />
                                    禁用设备
                                  </>
                                ) : (
                                  <>
                                    <Power className="mr-2 h-4 w-4" />
                                    启用设备
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteDevice(device)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除设备
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

            {/* 分页控件（统一组件） */}
            <Pagination
              className='mt-4'
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />

            {/* 对话框组件 */}
            {selectedDevice && (
              <DeviceDetailsDialog
                device={selectedDevice}
                open={deviceDetailsOpen}
                onOpenChange={setDeviceDetailsOpen}
              />
            )}

            {/* 删除确认对话框 */}
            <ConfirmDialog
              open={deleteConfirmOpen}
              onOpenChange={setDeleteConfirmOpen}
              title="确认删除设备"
              desc={
                <div className="space-y-2">
                  <p>您确定要删除以下设备吗？此操作无法撤销。</p>
                  {deviceToDelete && (
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm font-medium">{deviceToDelete.model}</p>
                      <p className="text-xs text-muted-foreground font-mono break-all">
                        {deviceToDelete.token.length > 40 
                          ? `${deviceToDelete.token.slice(0, 40)}...`
                          : deviceToDelete.token
                        }
                      </p>
                    </div>
                  )}
                </div>
              }
              confirmText="删除设备"
              cancelBtnText="取消"
              destructive
              isLoading={isDeleting}
              handleConfirm={handleConfirmDelete}
            />
        </Main>
      )}
    </>
  )
}
