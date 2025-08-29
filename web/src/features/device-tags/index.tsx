import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { useAuthStore } from '@/stores/auth-store'
import { TagService } from '@/services/tag-service'
import { NoAppSelected } from '@/components/no-app-selected'

import type { TagStatistic, DeviceTag } from '@/types/api'
import { Tag, Smartphone, Plus, Edit, Trash2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Pagination } from '@/components/pagination'

export function DeviceTags() {
  const [tagStats, setTagStats] = useState<TagStatistic[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deviceTags, setDeviceTags] = useState<DeviceTag[]>([])
  const [filteredTags, setFilteredTags] = useState<DeviceTag[]>([])
  const [filteredStats, setFilteredStats] = useState<TagStatistic[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statsSearchQuery, setStatsSearchQuery] = useState('')
  const [isTagsLoading, setIsTagsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('statistics')

  // 管理列表分页（前端分页）
  const [mgmtCurrentPage, setMgmtCurrentPage] = useState(1)
  const [mgmtPageSize, setMgmtPageSize] = useState(20)
  const [mgmtTotalItems, setMgmtTotalItems] = useState(0)
  const [mgmtTotalPages, setMgmtTotalPages] = useState(0)

  // 对话框状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<DeviceTag | null>(null)
  const [deletingTag, setDeletingTag] = useState<DeviceTag | null>(null)

  // 表单状态
  const [formData, setFormData] = useState({
    device_token: '',
    tag_name: '',
    tag_value: ''
  })

  const { currentApp } = useAuthStore()

  // 分页（用于标签统计）
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    if (currentApp?.id) {
      loadTagStatistics()
      if (activeTab === 'management') {
        loadDeviceTagsPaged()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp?.id, activeTab, currentPage, pageSize, statsSearchQuery])

  // 管理页：当分页或搜索变更时，自动加载后端分页数据
  useEffect(() => {
    if (currentApp?.id && activeTab === 'management') {
      loadDeviceTagsPaged()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp?.id, activeTab, mgmtCurrentPage, mgmtPageSize, searchQuery])

  useEffect(() => {
    // 过滤标签
    if (!searchQuery.trim()) {
      setFilteredTags(deviceTags)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = deviceTags.filter(tag =>
        tag.device_token.toLowerCase().includes(query) ||
        tag.tag_name.toLowerCase().includes(query) ||
        tag.tag_value.toLowerCase().includes(query)
      )
      setFilteredTags(filtered)
    }
  }, [deviceTags, searchQuery])

  // 仅当搜索词变化时重置“标签管理”分页到第1页，避免翻页后被数据更新覆盖
  useEffect(() => {
    setMgmtCurrentPage(1)
  }, [searchQuery])

  useEffect(() => {
    // 过滤统计数据（本地过滤当前页）
    if (!statsSearchQuery.trim()) {
      setFilteredStats(tagStats || [])
    } else {
      const query = statsSearchQuery.toLowerCase()
      const filtered = (tagStats || []).filter(stat =>
        stat.tag_name.toLowerCase().includes(query) ||
        stat.tag_value.toLowerCase().includes(query)
      )
      setFilteredStats(filtered)
    }
  }, [tagStats, statsSearchQuery])

  const loadTagStatistics = async () => {
    if (!currentApp?.id) return

    try {
      setIsLoading(true)
      const resp = await TagService.getTagStatistics(currentApp.id, {
        page: currentPage,
        page_size: pageSize,
        filters: { search: statsSearchQuery || undefined }
      })
      setTagStats(resp.data.items || [])
      setTotalItems(resp.total_items)
      setTotalPages(resp.total_pages)
    } catch (error) {
      console.error('加载标签统计失败:', error)
      toast.error('加载标签统计失败')
    } finally {
      setIsLoading(false)
    }
  }

  const loadDeviceTagsPaged = async () => {
    if (!currentApp?.id) return

    try {
      setIsTagsLoading(true)
      const resp = await TagService.getDeviceTagsPaged(currentApp.id, {
        page: mgmtCurrentPage,
        page_size: mgmtPageSize,
        filters: {
          search: searchQuery || undefined,
        },
      })
      setDeviceTags(resp.data.items || [])
      setMgmtCurrentPage(resp.current_page)
      setMgmtPageSize(resp.page_size)
      setMgmtTotalItems(resp.total_items)
      setMgmtTotalPages(resp.total_pages)
    } catch (error) {
      console.error('加载设备标签失败:', error)
      toast.error('加载设备标签失败')
    } finally {
      setIsTagsLoading(false)
    }
  }

  const handleCreateTag = async () => {
    if (!currentApp?.id || !formData.device_token || !formData.tag_name) {
      toast.error('请填写完整信息')
      return
    }

    try {
      await TagService.addDeviceTag(currentApp.id, formData.device_token, {
        tag_name: formData.tag_name,
        tag_value: formData.tag_value
      })

      toast.success('标签创建成功')
      setIsCreateDialogOpen(false)
      setFormData({ device_token: '', tag_name: '', tag_value: '' })

      await loadTagStatistics()
      if (activeTab === 'management') {
        setMgmtCurrentPage(1)
        await loadDeviceTagsPaged()
      }
    } catch (error) {
      console.error('创建标签失败:', error)
      toast.error('创建标签失败')
    }
  }

  const handleEditTag = async () => {
    if (!currentApp?.id || !editingTag || !formData.tag_name) {
      toast.error('请填写完整信息')
      return
    }

    try {
      await TagService.deleteDeviceTag(currentApp.id, editingTag.device_token, editingTag.tag_name)
      await TagService.addDeviceTag(currentApp.id, editingTag.device_token, {
        tag_name: formData.tag_name,
        tag_value: formData.tag_value
      })

      toast.success('标签更新成功')
      setIsEditDialogOpen(false)
      setEditingTag(null)
      setFormData({ device_token: '', tag_name: '', tag_value: '' })

      await loadTagStatistics()
      if (activeTab === 'management') {
        setMgmtCurrentPage(1)
        await loadDeviceTagsPaged()
      }
    } catch (error) {
      console.error('更新标签失败:', error)
      toast.error('更新标签失败')
    }
  }

  const handleDeleteTag = async () => {
    if (!currentApp?.id || !deletingTag) return

    try {
      await TagService.deleteDeviceTag(currentApp.id, deletingTag.device_token, deletingTag.tag_name)
      toast.success('标签删除成功')
      setIsDeleteDialogOpen(false)
      setDeletingTag(null)

      await loadTagStatistics()
      if (activeTab === 'management') {
        setMgmtCurrentPage(1)
        await loadDeviceTagsPaged()
      }
    } catch (error) {
      console.error('删除标签失败:', error)
      toast.error('删除标签失败')
    }
  }

  const openDeleteDialog = (tag: DeviceTag) => {
    setDeletingTag(tag)
    setIsDeleteDialogOpen(true)
  }

  const openEditDialog = (tag: DeviceTag) => {
    setEditingTag(tag)
    setFormData({
      device_token: tag.device_token,
      tag_name: tag.tag_name,
      tag_value: tag.tag_value
    })
    setIsEditDialogOpen(true)
  }

  const openCreateDialog = () => {
    setFormData({ device_token: '', tag_name: '', tag_value: '' })
    setIsCreateDialogOpen(true)
  }

  if (!currentApp) {
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

        <NoAppSelected
          icon={<Tag className="h-16 w-16 text-muted-foreground" />}
          description="请选择应用以管理设备标签"
        />
      </>
    )
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

      <Main>
        <div className='space-y-6'>
          <div className='flex items-center justify-between mb-6 gap-4'>
            <div className='flex flex-col gap-1'>
              <h1 className='text-2xl font-bold tracking-tight'>设备标签管理</h1>
              <p className='text-muted-foreground'>
                管理 "{currentApp.name}" 应用的设备标签，用于精准推送和设备分群
              </p>
            </div>
            <div className='flex items-center gap-2'>
              {activeTab === 'statistics' ? (
                <Button variant="outline" onClick={loadTagStatistics} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  刷新统计
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={loadDeviceTagsPaged} disabled={isTagsLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isTagsLoading ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                  <Button onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    添加标签
                  </Button>
                </>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
            <TabsList>
              <TabsTrigger value="statistics">标签统计</TabsTrigger>
              <TabsTrigger value="management">标签管理</TabsTrigger>
            </TabsList>

            <TabsContent value="statistics" className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex-1">
                  <Input
                    placeholder="搜索标签名称或标签值..."
                    value={statsSearchQuery}
                    onChange={(e) => setStatsSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                  {[...Array(6)].map((_, i) => (
                    <Card key={i}>
                      <CardHeader className='pb-3'>
                        <div className='h-4 w-20 animate-pulse rounded bg-muted' />
                        <div className='h-3 w-16 animate-pulse rounded bg-muted' />
                      </CardHeader>
                      <CardContent>
                        <div className='h-8 w-12 animate-pulse rounded bg-muted' />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : !tagStats || tagStats.length === 0 ? (
                <Card>
                  <CardContent className='flex h-40 items-center justify-center'>
                    <div className='text-center text-muted-foreground py-8'>
                      暂无标签数据
                    </div>
                  </CardContent>
                </Card>
              ) : filteredStats.length === 0 ? (
                <Card>
                  <CardContent className='flex h-40 items-center justify-center'>
                    <div className='text-center text-muted-foreground py-8'>
                      {statsSearchQuery ? '没有找到匹配的标签统计' : '暂无标签数据'}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                  {filteredStats?.map((stat, index) => (
                    <Card key={index} className="transition-all duration-200 hover:shadow-md">
                      <CardHeader className='pb-3'>
                        <div className='flex items-start justify-between'>
                          <CardTitle className='text-base font-medium text-foreground'>
                            {stat.tag_name}
                          </CardTitle>
                          <Tag className='h-4 w-4 text-muted-foreground' />
                        </div>
                        <CardDescription className='flex items-center gap-1'>
                          <Badge variant='outline' className="text-xs">{stat.tag_value}</Badge>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className='flex items-center gap-2'>
                          <Smartphone className='h-4 w-4 text-primary' />
                          <span className='text-2xl font-bold text-primary'>{stat.device_count}</span>
                          <span className='text-sm text-muted-foreground'>设备</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* 统计分页 */}
              <Pagination
                className='mt-4'
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </TabsContent>

            <TabsContent value="management" className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex-1">
                  <Input
                    placeholder="搜索设备Token、标签名称或标签值..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
              </div>

              <Card className='p-0'>
                <CardContent className="p-0">
                  {isTagsLoading ? (
                    <div className="flex items-center justify-center h-40">
                      <div className="text-center">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                        <p className="text-muted-foreground">加载中...</p>
                      </div>
                    </div>
                  ) : filteredTags.length === 0 ? (
                    <div className="flex items-center justify-center h-40">
                      <div className="text-center text-muted-foreground">
                        {searchQuery ? '没有找到匹配的标签' : '暂无标签数据'}
                      </div>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>设备Token</TableHead>
                          <TableHead>标签名称</TableHead>
                          <TableHead>标签值</TableHead>
                          <TableHead>创建时间</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deviceTags.map((tag) => (
                          <TableRow key={`tag-${tag.id}`}>
                            <TableCell className="font-mono text-sm">
                              {tag.device_token.length > 20
                                ? `${tag.device_token.slice(0, 20)}...`
                                : tag.device_token}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{tag.tag_name}</Badge>
                            </TableCell>
                            <TableCell>{tag.tag_value}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(tag.created_at).toLocaleString('zh-CN')}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(tag)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(tag)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* 管理分页 */}
              <Pagination
                className='mt-4'
                currentPage={mgmtCurrentPage}
                totalPages={mgmtTotalPages}
                pageSize={mgmtPageSize}
                totalItems={mgmtTotalItems}
                onPageChange={(p) => { setMgmtCurrentPage(p) }}
                onPageSizeChange={(size) => { setMgmtPageSize(size); setMgmtCurrentPage(1) }}
              />
            </TabsContent>
          </Tabs>

          {/* 创建标签对话框 */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加设备标签</DialogTitle>
                <DialogDescription>
                  为指定设备添加新的标签
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="device_token">设备Token *</Label>
                  <Input
                    id="device_token"
                    value={formData.device_token}
                    onChange={(e) => setFormData(prev => ({ ...prev, device_token: e.target.value }))}
                    placeholder="请输入设备Token"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tag_name">标签名称 *</Label>
                  <Input
                    id="tag_name"
                    value={formData.tag_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, tag_name: e.target.value }))}
                    placeholder="例如：vip_level"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tag_value">标签值</Label>
                  <Input
                    id="tag_value"
                    value={formData.tag_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, tag_value: e.target.value }))}
                    placeholder="例如：gold"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateTag}>
                  创建
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 编辑标签对话框 */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>编辑设备标签</DialogTitle>
                <DialogDescription>
                  修改设备标签信息
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit_device_token">设备Token</Label>
                  <Input
                    id="edit_device_token"
                    value={formData.device_token}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_tag_name">标签名称 *</Label>
                  <Input
                    id="edit_tag_name"
                    value={formData.tag_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, tag_name: e.target.value }))}
                    placeholder="例如：vip_level"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_tag_value">标签值</Label>
                  <Input
                    id="edit_tag_value"
                    value={formData.tag_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, tag_value: e.target.value }))}
                    placeholder="例如：gold"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleEditTag}>
                  更新
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 删除标签确认对话框 */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认删除标签</DialogTitle>
                <DialogDescription>
                  您确定要删除这个设备标签吗？此操作不可撤销。
                </DialogDescription>
              </DialogHeader>
              {deletingTag && (
                <div className="py-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">设备Token:</span>
                      <span className="font-mono">
                        {deletingTag.device_token.length > 20
                          ? `${deletingTag.device_token.slice(0, 20)}...`
                          : deletingTag.device_token}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">标签名称:</span>
                      <Badge variant="outline">{deletingTag.tag_name}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">标签值:</span>
                      <span>{deletingTag.tag_value}</span>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                  取消
                </Button>
                <Button variant="destructive" onClick={handleDeleteTag}>
                  删除
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Main>
    </>
  )
}
