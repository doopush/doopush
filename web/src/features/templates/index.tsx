import { useEffect, useState } from 'react'
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Eye,
  Copy,
  Play,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

import { useAuthStore } from '@/stores/auth-store'
import { TemplateService } from '@/services/template-service'
import { NoAppSelected } from '@/components/no-app-selected'
import { APP_SELECTION_DESCRIPTIONS } from '@/utils/app-utils'
import { CreateTemplateDialog } from './components/create-template-dialog'
import { EditTemplateDialog } from './components/edit-template-dialog'
import { DeleteTemplateDialog } from './components/delete-template-dialog'
import { TemplatePreviewDialog } from './components/template-preview-dialog'
import { TemplateRenderDialog } from './components/template-render-dialog'
import type { MessageTemplate } from '@/types/api'

export function Templates() {
  const { currentApp } = useAuthStore()
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // 对话框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [renderDialogOpen, setRenderDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null)

  // 加载模板列表
  useEffect(() => {
    if (currentApp) {
      loadTemplates()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp])

  const loadTemplates = async () => {
    if (!currentApp) return
    
    try {
      setLoading(true)
      const data = await TemplateService.getTemplates(currentApp.id)
      setTemplates(data.templates)
    } catch (error) {
      console.error('加载模板列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 筛选模板
  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 操作处理
  const handleEditTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template)
    setEditDialogOpen(true)
  }

  const handleDeleteTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template)
    setDeleteDialogOpen(true)
  }

  const handlePreviewTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template)
    setPreviewDialogOpen(true)
  }

  const handleRenderTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template)
    setRenderDialogOpen(true)
  }

  const handleCopyTemplate = (template: MessageTemplate) => {
    const templateData = {
      name: `${template.name}_copy`,
      title: template.title,
      content: template.content,
      variables: template.variables,
      platform: template.platform,
      locale: template.locale,
    }
    navigator.clipboard.writeText(JSON.stringify(templateData, null, 2))
    toast.success('模板内容已复制到剪贴板')
  }

  const handleTemplateCreated = () => {
    setCreateDialogOpen(false)
    loadTemplates()
  }

  const handleTemplateUpdated = () => {
    setEditDialogOpen(false)
    setSelectedTemplate(null)
    loadTemplates()
  }

  const handleTemplateDeleted = () => {
    setDeleteDialogOpen(false)
    setSelectedTemplate(null)
    loadTemplates()
  }

  const getPlatformBadge = (platform: string) => {
    const variants = {
      ios: 'bg-blue-100 text-blue-800',
      android: 'bg-green-100 text-green-800',
      all: 'bg-purple-100 text-purple-800',
    }
    return variants[platform as keyof typeof variants] || 'bg-gray-100 text-gray-800'
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive 
      ? { label: '启用', className: 'bg-green-100 text-green-800' }
      : { label: '禁用', className: 'bg-red-100 text-red-800' }
  }

  const extractVariables = (text: string): string[] => {
    const regex = /\{\{\.?([a-zA-Z0-9_]+)\}\}/g
    const variables = new Set<string>()
    let match
    
    while ((match = regex.exec(text)) !== null) {
      variables.add(match[1])
    }
    
    return Array.from(variables)
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
          icon={<FileText className="h-16 w-16 text-muted-foreground" />}
          description={APP_SELECTION_DESCRIPTIONS.templates}
        />
      ) : (
        <Main>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex flex-col gap-1'>
                <h1 className='text-2xl font-bold tracking-tight'>消息模板</h1>
                <p className='text-muted-foreground'>
                  管理应用 "{currentApp.name}" 的推送消息模板
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <Button variant="outline" onClick={loadTemplates}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </Button>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  创建模板
                </Button>
              </div>
            </div>

            {/* 搜索框 */}
            <div className='mb-6'>
              <Input
                placeholder='搜索模板名称或标题...'
                className='h-9 w-full max-w-sm'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* 模板列表表格 */}
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>模板信息</TableHead>
                    <TableHead>变量</TableHead>
                    <TableHead>平台</TableHead>
                    <TableHead>版本</TableHead>
                    <TableHead>状态</TableHead>
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
                          <div className="space-y-2">
                            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                          </div>
                        </TableCell>
                        <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-12 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-12 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-8 bg-muted rounded animate-pulse" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredTemplates.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {searchTerm ? '未找到匹配的模板' : '暂无消息模板'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{template.name}</div>
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {template.title}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const variables = extractVariables(template.title + ' ' + template.content)
                            return (
                              <div className="flex flex-wrap gap-1">
                                {variables.length > 0 ? (
                                  variables.map((variable) => (
                                    <Badge key={variable} variant="outline" className="text-xs">
                                      {variable}
                                    </Badge>
                                  ))
                                ) : (
                                  <span>-</span>
                                )}
                              </div>
                            )
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge className={getPlatformBadge(template.platform)}>
                            {template.platform === 'all' ? '全平台' : template.platform.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            v{template.version}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(template.is_active).className}>
                            {getStatusBadge(template.is_active).label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(template.created_at).toLocaleString('zh-CN', {
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
                              <DropdownMenuItem onClick={() => handlePreviewTemplate(template)}>
                                <Eye className="mr-2 h-4 w-4" />
                                预览模板
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRenderTemplate(template)}>
                                <Play className="mr-2 h-4 w-4" />
                                测试渲染
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyTemplate(template)}>
                                <Copy className="mr-2 h-4 w-4" />
                                复制内容
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                                <Edit className="mr-2 h-4 w-4" />
                                编辑模板
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteTemplate(template)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除模板
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
            <CreateTemplateDialog 
              open={createDialogOpen}
              onOpenChange={setCreateDialogOpen}
              onSuccess={handleTemplateCreated}
            />
            
            {selectedTemplate && (
              <>
                <EditTemplateDialog
                  template={selectedTemplate}
                  open={editDialogOpen}
                  onOpenChange={setEditDialogOpen}
                  onSuccess={handleTemplateUpdated}
                />
                
                <DeleteTemplateDialog
                  template={selectedTemplate}
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                  onSuccess={handleTemplateDeleted}
                />
                
                <TemplatePreviewDialog
                  template={selectedTemplate}
                  open={previewDialogOpen}
                  onOpenChange={setPreviewDialogOpen}
                />
                
                <TemplateRenderDialog
                  template={selectedTemplate}
                  open={renderDialogOpen}
                  onOpenChange={setRenderDialogOpen}
                />
              </>
            )}
        </Main>
      )}
    </>
  )
}
