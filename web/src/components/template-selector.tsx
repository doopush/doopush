import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Check, ChevronsUpDown, FileText, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { TemplateService } from '@/services/template-service'
import { useAuthStore } from '@/stores/auth-store'
import type { MessageTemplate } from '@/types/api'
import { toast } from 'sonner'

interface TemplateSelectorProps {
  value?: number
  onValueChange?: (templateId: number | undefined) => void
  onTemplateApply?: (template: {
    title: string
    content: string
    variables?: Record<string, string>
  }) => void
  platform?: string
  className?: string
}

interface TemplateVariables {
  [key: string]: {
    type: string
    description: string
    default?: string
  }
}

export function TemplateSelector({
  value,
  onValueChange,
  onTemplateApply,
  platform = 'all',
  className,
}: TemplateSelectorProps) {
  const { currentApp } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [renderOpen, setRenderOpen] = useState(false)
  const [renderData, setRenderData] = useState<Record<string, string>>({})

  // 加载模板列表
  useEffect(() => {
    if (currentApp && open) {
      loadTemplates()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp, open, platform])

  const loadTemplates = async () => {
    if (!currentApp) return

    try {
      setLoading(true)
      const resp = await TemplateService.getTemplates(currentApp.id, { 
        page: 1, 
        page_size: 100 
      })
      
      // 根据平台筛选模板
      const filteredTemplates = resp.data.items.filter((template: MessageTemplate) => 
        template.is_active && (template.platform === platform || template.platform === 'all')
      )
      
      setTemplates(filteredTemplates)
    } catch (error) {
      console.error('加载模板列表失败:', error)
      toast.error('加载模板列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 获取选中的模板
  const currentTemplate = templates.find(t => t.id === value)

  // 提取模板变量
  const extractVariables = (text: string): string[] => {
    const regex = /\{\{\.?([a-zA-Z0-9_]+)\}\}/g
    const variables = new Set<string>()
    let match
    
    while ((match = regex.exec(text)) !== null) {
      variables.add(match[1])
    }
    
    return Array.from(variables)
  }

  // 获取模板变量定义
  const getTemplateVariables = (template: MessageTemplate): TemplateVariables => {
    if (!template.variables) return {}
    
    try {
      return JSON.parse(template.variables)
    } catch {
      return {}
    }
  }

  // 预览模板
  const handlePreview = (template: MessageTemplate) => {
    setSelectedTemplate(template)
    setPreviewOpen(true)
  }

  // 创建动态表单
  const renderForm = useForm({
    defaultValues: {} as Record<string, string>
  })

  // 测试渲染
  const handleRender = (template: MessageTemplate) => {
    setSelectedTemplate(template)

    // 检查是否有变量
    const variables = extractVariables(template.title + ' ' + template.content)

    if (variables.length === 0) {
      // 没有变量，直接应用模板
      onTemplateApply?.({
        title: template.title,
        content: template.content,
      })
      return
    }

    // 有变量，初始化渲染数据并打开配置对话框
    const templateVars = getTemplateVariables(template)
    const initialData: Record<string, string> = {}

    variables.forEach(varName => {
      initialData[varName] = templateVars[varName]?.default || ''
    })

    setRenderData(initialData)
    renderForm.reset(initialData)
    setRenderOpen(true)
  }

  // 应用模板
  const handleApplyTemplate = async (formData?: Record<string, string>) => {
    if (!selectedTemplate || !currentApp) return

    const data = formData || renderData

    try {
      const variables = extractVariables(selectedTemplate.title + ' ' + selectedTemplate.content)

      if (variables.length > 0) {
        // 如果有变量，使用渲染接口
        const rendered = await TemplateService.renderTemplate(
          currentApp.id,
          selectedTemplate.id,
          data
        )

        onTemplateApply?.({
          title: rendered.title,
          content: rendered.content,
          variables: data,
        })
      } else {
        // 如果没有变量，直接使用模板内容
        onTemplateApply?.({
          title: selectedTemplate.title,
          content: selectedTemplate.content,
        })
      }

      setRenderOpen(false)
    } catch (error) {
      console.error('应用模板失败:', error)
      toast.error('应用模板失败')
    }
  }

  // 表单提交处理
  const onSubmit = async (data: Record<string, string>) => {
    await handleApplyTemplate(data)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", className)}
          >
            {currentTemplate ? (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="truncate">{currentTemplate.name}</span>
                <Badge variant="outline" className="ml-auto">
                  v{currentTemplate.version}
                </Badge>
              </div>
            ) : (
              <span className="text-muted-foreground">选择消息模板...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="搜索模板..." />
            <CommandList>
              <CommandEmpty>
                {loading ? '加载中...' : '未找到模板'}
              </CommandEmpty>
              <CommandGroup>
                {/* 清除选择选项 */}
                <CommandItem
                  onSelect={() => {
                    onValueChange?.(undefined)
                    setOpen(false)
                    // 清除模板选择时关闭渲染对话框
                    setRenderOpen(false)
                    setSelectedTemplate(null)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground">不使用模板</span>
                </CommandItem>
                
                {templates.map((template) => (
                  <CommandItem
                    key={template.id}
                    onSelect={() => {
                      onValueChange?.(template.id)
                      setOpen(false)
                      // 选中模板后自动进入渲染配置
                      handleRender(template)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === template.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        <Badge variant="outline" className="text-xs">
                          v{template.version}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            template.platform === 'ios' && "bg-blue-100 text-blue-800",
                            template.platform === 'android' && "bg-green-100 text-green-800",
                            template.platform === 'all' && "bg-purple-100 text-purple-800"
                          )}
                        >
                          {template.platform === 'all' ? '全平台' : template.platform.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {template.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePreview(template)
                        }}
                        title="预览模板"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* 模板预览对话框 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>模板预览</DialogTitle>
            <DialogDescription>
              查看模板的详细内容和变量定义
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="flex-1 overflow-auto -mx-6 px-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">模板名称</Label>
                  <div className="font-medium">{selectedTemplate.name}</div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">版本</Label>
                  <div className="font-medium">v{selectedTemplate.version}</div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">平台</Label>
                  <Badge variant="outline">
                    {selectedTemplate.platform === 'all' ? '全平台' : selectedTemplate.platform.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">语言</Label>
                  <div className="font-medium">{selectedTemplate.locale}</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">推送标题</Label>
                  <div className="p-2 bg-muted rounded text-sm">
                    {selectedTemplate.title}
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">推送内容</Label>
                  <div className="p-2 bg-muted rounded text-sm whitespace-pre-wrap">
                    {selectedTemplate.content}
                  </div>
                </div>
                
                {(() => {
                  const variables = extractVariables(selectedTemplate.title + ' ' + selectedTemplate.content)
                  return variables.length > 0 && (
                    <div className="grid gap-2">
                      <Label className="text-muted-foreground">模板变量</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {variables.map((variable) => (
                          <Badge key={variable} variant="outline" className="text-xs">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 模板渲染对话框 */}
      <Dialog open={renderOpen} onOpenChange={setRenderOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>配置模板变量</DialogTitle>
            <DialogDescription>
              {selectedTemplate && `正在配置模板"${selectedTemplate.name}"，填写变量值并预览最终效果`}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="flex-1 overflow-auto -mx-6 px-6 space-y-6">
              {(() => {
                const variables = extractVariables(selectedTemplate.title + ' ' + selectedTemplate.content)
                const templateVars = getTemplateVariables(selectedTemplate)

                return variables.length > 0 ? (
                  <>
                    {/* 变量输入表单 */}
                    <div>
                      <h3 className="text-lg font-medium mb-4">变量赋值</h3>

                      <Form {...renderForm}>
                        <form onSubmit={renderForm.handleSubmit(onSubmit)} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {variables.map((varName) => {
                              const definition = templateVars[varName]
                              return (
                                <FormField
                                  key={varName}
                                  control={renderForm.control}
                                  name={varName}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="flex items-center gap-2">
                                        <Badge variant="outline">{varName}</Badge>
                                        {definition?.description && (
                                          <span className="text-xs text-muted-foreground">
                                            {definition.description}
                                          </span>
                                        )}
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder={definition?.default || `请输入 ${varName} 的值`}
                                          {...field}
                                        />
                                      </FormControl>
                                      {definition?.type && (
                                        <p className="text-xs text-muted-foreground">
                                          类型: {definition.type}
                                        </p>
                                      )}
                                    </FormItem>
                                  )}
                                />
                              )
                            })}
                          </div>


                        </form>
                      </Form>
                    </div>

                    {/* 预览效果 */}
                    <div>
                      <h3 className="text-lg font-medium mb-4">预览效果</h3>

                      {/* 手机样式预览 */}
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="bg-background border rounded-lg p-4 max-w-sm mx-auto shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                              <span className="text-primary-foreground text-sm font-medium">📱</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm leading-tight">
                                {selectedTemplate.title.replace(/\{\{([^}]+)\}\}/g, (match, varName) =>
                                  renderForm.watch(varName) || match
                                )}
                              </div>
                              <div className="text-muted-foreground text-sm mt-1 leading-tight">
                                {selectedTemplate.content.replace(/\{\{([^}]+)\}\}/g, (match, varName) =>
                                  renderForm.watch(varName) || match
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-2">
                                刚刚 • {selectedTemplate.platform === 'all' ? 'iOS/Android' : selectedTemplate.platform}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <h3 className="text-lg font-medium mb-4">预览效果</h3>

                    {/* 手机样式预览 */}
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="bg-background border rounded-lg p-4 max-w-sm mx-auto shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                            <span className="text-primary-foreground text-sm font-medium">📱</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm leading-tight">
                              {selectedTemplate.title}
                            </div>
                            <div className="text-muted-foreground text-sm mt-1 leading-tight">
                              {selectedTemplate.content}
                            </div>
                            <div className="text-xs text-muted-foreground mt-2">
                              刚刚 • {selectedTemplate.platform === 'all' ? 'iOS/Android' : selectedTemplate.platform}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenderOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={renderForm.handleSubmit(onSubmit)}
            >
              确认应用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
