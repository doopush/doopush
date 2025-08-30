import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, FileText, Eye, Play } from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  // 测试渲染
  const handleRender = (template: MessageTemplate) => {
    setSelectedTemplate(template)
    
    // 初始化渲染数据
    const variables = extractVariables(template.title + ' ' + template.content)
    const templateVars = getTemplateVariables(template)
    const initialData: Record<string, string> = {}
    
    variables.forEach(varName => {
      initialData[varName] = templateVars[varName]?.default || ''
    })
    
    setRenderData(initialData)
    setRenderOpen(true)
  }

  // 应用模板
  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !currentApp) return

    try {
      const variables = extractVariables(selectedTemplate.title + ' ' + selectedTemplate.content)
      
      if (variables.length > 0) {
        // 如果有变量，使用渲染接口
        const rendered = await TemplateService.renderTemplate(
          currentApp.id,
          selectedTemplate.id,
          renderData
        )
        
        onTemplateApply?.({
          title: rendered.title,
          content: rendered.content,
          variables: renderData,
        })
      } else {
        // 如果没有变量，直接使用模板内容
        onTemplateApply?.({
          title: selectedTemplate.title,
          content: selectedTemplate.content,
        })
      }
      
      setRenderOpen(false)
      toast.success('模板应用成功')
    } catch (error) {
      console.error('应用模板失败:', error)
      toast.error('应用模板失败')
    }
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
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRender(template)
                        }}
                      >
                        <Play className="h-3 w-3" />
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>应用模板</DialogTitle>
            <DialogDescription>
              配置模板变量并预览最终效果
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <>
              <div className="flex-1 overflow-auto -mx-6 px-6 space-y-4">
                {(() => {
                  const variables = extractVariables(selectedTemplate.title + ' ' + selectedTemplate.content)
                  const templateVars = getTemplateVariables(selectedTemplate)
                  
                  return variables.length > 0 ? (
                    <>
                      <div>
                        <Label className="text-sm font-medium">配置变量值</Label>
                        <div className="grid gap-3 mt-2">
                          {variables.map((varName) => (
                            <div key={varName} className="grid gap-1.5">
                              <Label className="text-xs text-muted-foreground">
                                {varName}
                                {templateVars[varName]?.description && (
                                  <span className="ml-1">({templateVars[varName].description})</span>
                                )}
                              </Label>
                              <Input
                                placeholder={templateVars[varName]?.default || `请输入${varName}的值`}
                                value={renderData[varName] || ''}
                                onChange={(e) => setRenderData(prev => ({
                                  ...prev,
                                  [varName]: e.target.value
                                }))}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">预览效果</Label>
                        <Card className="mt-2 gap-1">
                          <CardHeader>
                            <CardTitle className="text-sm">
                              {selectedTemplate.title.replace(/\{\{([^}]+)\}\}/g, (match, varName) => 
                                renderData[varName] || match
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {selectedTemplate.content.replace(/\{\{([^}]+)\}\}/g, (match, varName) => 
                                renderData[varName] || match
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  ) : (
                    <div>
                      <Label className="text-sm font-medium">预览效果</Label>
                      <Card className="mt-2 gap-1">
                        <CardHeader>
                          <CardTitle className="text-sm">{selectedTemplate.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {selectedTemplate.content}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })()}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setRenderOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleApplyTemplate}>
                  应用模板
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
