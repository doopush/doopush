import { useEffect, useState } from 'react'
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Filter,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
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
import { useAuthStore } from '@/stores/auth-store'
import { DeviceService } from '@/services/device-service'
import { NoAppSelected } from '@/components/no-app-selected'
import { APP_SELECTION_DESCRIPTIONS } from '@/utils/app-utils'
import { toast } from 'sonner'
import type { DeviceGroup } from '@/types/api'
import { CreateGroupDialog } from './components/create-group-dialog'
import { EditGroupDialog } from './components/edit-group-dialog'
import { EditRulesDialog } from './components/edit-rules-dialog'

export function DeviceGroups() {
  const { currentApp } = useAuthStore()
  const [groups, setGroups] = useState<DeviceGroup[]>([])
  const [loading, setLoading] = useState(true)
  
  // 弹窗状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<DeviceGroup | null>(null)

  // 加载设备分组
  useEffect(() => {
    if (currentApp) {
      loadGroups()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp])

  const loadGroups = async () => {
    if (!currentApp) return
    
    try {
      setLoading(true)
      const data = await DeviceService.getDeviceGroups(currentApp.id)
      setGroups(data.groups)
    } catch (error) {
      console.error('加载设备分组失败:', error)
      toast.error('加载设备分组失败')
    } finally {
      setLoading(false)
    }
  }

  // 弹窗操作处理
  const handleCreateGroup = () => {
    setCreateDialogOpen(true)
  }

  const handleEditGroup = (group: DeviceGroup) => {
    setSelectedGroup(group)
    setEditDialogOpen(true)
  }

  const handleEditRules = (group: DeviceGroup) => {
    setSelectedGroup(group)
    setRulesDialogOpen(true)
  }

  const handleDeleteGroup = async (group: DeviceGroup) => {
    if (!currentApp) return
    
    try {
      await DeviceService.deleteDeviceGroup(currentApp.id, group.id)
      loadGroups()
      toast.success('设备分组删除成功')
    } catch (error) {
      toast.error((error as Error).message || '删除设备分组失败')
    }
  }

  const handleDialogSuccess = () => {
    loadGroups()
  }

  const getStatusBadge = (status: number) => {
    return status === 1 
      ? { label: '启用', className: 'bg-green-100 text-green-800' }
      : { label: '禁用', className: 'bg-red-100 text-red-800' }
  }

  const parseConditions = (conditions: string) => {
    try {
      const filterRules = JSON.parse(conditions) as Array<{
        field: string
        operator: string
        value: {
          string_value?: string
          string_values?: string[]
        }
      }>

      if (!Array.isArray(filterRules) || filterRules.length === 0) {
        return '无条件'
      }

      const operatorMap: Record<string, string> = {
        'equals': '等于',
        'contains': '包含',
        'in': '包含于',
        'not_in': '不包含于',
        'is_null': '为空',
        'is_not_null': '不为空'
      }

      const fieldMap: Record<string, string> = {
        'platform': '平台',
        'brand': '品牌',
        'model': '设备型号',
        'system_version': '系统版本',
        'app_version': '应用版本',
        'channel': '推送通道'
      }

      return filterRules.map(rule => {
        const fieldName = fieldMap[rule.field] || rule.field
        const operatorName = operatorMap[rule.operator] || rule.operator
        
        let valueText = ''
        if (rule.value.string_value) {
          valueText = rule.value.string_value
        } else if (rule.value.string_values && rule.value.string_values.length > 0) {
          valueText = rule.value.string_values.join(', ')
        }

        if (rule.operator === 'is_null' || rule.operator === 'is_not_null') {
          return `${fieldName} ${operatorName}`
        }
        
        return `${fieldName} ${operatorName} ${valueText}`
      }).join(' 且 ')
    } catch (error) {
      console.error('解析筛选条件失败:', error)
      return '解析失败'
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

      {!currentApp ? (
        <NoAppSelected 
          icon={<Shield className="h-16 w-16 text-muted-foreground" />}
          description={APP_SELECTION_DESCRIPTIONS.deviceGroups}
        />
      ) : (
        <Main>
          <div className="space-y-6">
            <div className='flex items-center justify-between'>
              <div className='flex flex-col gap-1'>
                <h1 className='text-2xl font-bold tracking-tight'>设备分组管理</h1>
                <p className='text-muted-foreground'>
                  管理应用 "{currentApp.name}" 的设备分组，支持基于条件的自动分组
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  onClick={handleCreateGroup}
                  disabled={loading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  创建分组
                </Button>
                <Button variant="outline" onClick={loadGroups}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </Button>
              </div>
            </div>



            {/* 分组列表 */}
            <div className="space-y-4">
              <h4 className="font-medium">设备分组列表</h4>

              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>分组名称</TableHead>
                        <TableHead>描述</TableHead>
                        <TableHead>筛选条件</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>创建时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            暂无设备分组
                          </TableCell>
                        </TableRow>
                      ) : (
                        groups.map((group) => (
                          <TableRow key={group.id}>
                            <TableCell>
                              <div className="font-medium">{group.name}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground max-w-xs truncate">
                                {group.description || '无描述'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-muted-foreground max-w-xs truncate">
                                {parseConditions(group.conditions)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusBadge(group.status).className}>
                                {getStatusBadge(group.status).label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(group.created_at).toLocaleString('zh-CN', {
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
                                  <DropdownMenuItem onClick={() => handleEditGroup(group)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    编辑分组
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditRules(group)}>
                                    <Filter className="mr-2 h-4 w-4" />
                                    编辑规则
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteGroup(group)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    删除分组
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
              )}
            </div>
          </div>

          {/* 弹窗组件 */}
          <CreateGroupDialog
            app={currentApp}
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            onSuccess={handleDialogSuccess}
          />
          
          <EditGroupDialog
            app={currentApp}
            group={selectedGroup}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onSuccess={handleDialogSuccess}
          />
          
          <EditRulesDialog
            app={currentApp}
            group={selectedGroup}
            open={rulesDialogOpen}
            onOpenChange={setRulesDialogOpen}
            onSuccess={handleDialogSuccess}
          />
        </Main>
      )}
    </>
  )
}
