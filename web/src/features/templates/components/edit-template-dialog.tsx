import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import { TemplateService } from '@/services/template-service'
import { requireApp } from '@/utils/app-utils'
import { toast } from 'sonner'
import type { MessageTemplate, TemplateVariable } from '@/types/api'

// 表单验证规则 (与创建模板相同)
const editTemplateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').max(100, '名称不能超过100个字符'),
  title: z.string().min(1, '推送标题不能为空').max(200, '标题不能超过200个字符'),
  content: z.string().min(1, '推送内容不能为空').max(1000, '内容不能超过1000个字符'),
  payload: z.string().optional(),
  platform: z.enum(['ios', 'android', 'all']).refine(val => val, {
    message: '请选择支持的平台',
  }),
  locale: z.string().min(1, '请选择语言'),
  is_active: z.boolean(),
})

type EditTemplateFormData = z.infer<typeof editTemplateSchema>

interface EditTemplateDialogProps {
  template: MessageTemplate
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditTemplateDialog({ template, open, onOpenChange, onSuccess }: EditTemplateDialogProps) {
  const { currentApp } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [variables, setVariables] = useState<Record<string, TemplateVariable>>({})

  const form = useForm<EditTemplateFormData>({
    resolver: zodResolver(editTemplateSchema),
    defaultValues: {
      name: '',
      title: '',
      content: '',
      payload: '',
      platform: 'all',
      locale: 'zh-CN',
      is_active: true,
    },
  })

  // 当模板数据变化时更新表单
  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        title: template.title,
        content: template.content,
        payload: template.payload || '',
        platform: template.platform as 'ios' | 'android' | 'all',
        locale: template.locale,
        is_active: template.is_active,
      })

      // 解析现有变量
      try {
        const parsedVariables = template.variables ? JSON.parse(template.variables) : {}
        setVariables(parsedVariables)
      } catch {
        setVariables({})
      }
    }
  }, [template, form])

  const onSubmit = async (data: EditTemplateFormData) => {
    if (!requireApp(currentApp)) {
      return
    }

    try {
      setLoading(true)
      await TemplateService.updateTemplate(currentApp.id, template.id, {
        ...data,
        variables,
      })
      toast.success('模板更新成功')
      onSuccess()
    } catch (error) {
      toast.error((error as Error).message || '更新模板失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
    }
  }

  // 从模板内容中自动提取变量 (与创建模板相同的逻辑)
  const extractVariablesFromContent = () => {
    const title = form.watch('title')
    const content = form.watch('content')
    const payload = form.watch('payload')
    
    const text = [title, content, payload].join(' ')
    const regex = /\{\{\.?([a-zA-Z0-9_]+)\}\}/g
    const foundVariables = new Set<string>()
    let match
    
    while ((match = regex.exec(text)) !== null) {
      foundVariables.add(match[1])
    }
    
    // 为新发现的变量添加默认配置
    const newVariables = { ...variables }
    foundVariables.forEach(varName => {
      if (!newVariables[varName]) {
        newVariables[varName] = {
          type: 'string',
          description: `变量 ${varName}`,
          default: '',
        }
      }
    })
    
    // 删除不再使用的变量
    Object.keys(newVariables).forEach(varName => {
      if (!foundVariables.has(varName)) {
        delete newVariables[varName]
      }
    })
    
    setVariables(newVariables)
  }

  const addVariable = () => {
    const varName = `variable${Object.keys(variables).length + 1}`
    setVariables({
      ...variables,
      [varName]: {
        type: 'string',
        description: '新变量',
        default: '',
      }
    })
  }

  const updateVariable = (name: string, field: keyof TemplateVariable, value: string) => {
    setVariables({
      ...variables,
      [name]: {
        ...variables[name],
        [field]: value,
      }
    })
  }

  const removeVariable = (name: string) => {
    const newVariables = { ...variables }
    delete newVariables[name]
    setVariables(newVariables)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>编辑模板</DialogTitle>
          <DialogDescription>
            修改模板 "{template.name}" 的内容和配置
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>模板名称 *</FormLabel>
                      <FormControl>
                        <Input placeholder="欢迎消息模板" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="platform"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>支持平台 *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择平台" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">全平台</SelectItem>
                            <SelectItem value="ios">仅 iOS</SelectItem>
                            <SelectItem value="android">仅 Android</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="locale"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>语言 *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择语言" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="zh-CN">简体中文</SelectItem>
                            <SelectItem value="zh-TW">繁体中文</SelectItem>
                            <SelectItem value="en-US">English</SelectItem>
                            <SelectItem value="ja-JP">日本語</SelectItem>
                            <SelectItem value="ko-KR">한국어</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">启用模板</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* 消息内容 (与创建模板相同) */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>推送标题 *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="欢迎使用 {{app_name}}"
                          {...field}
                          onBlur={() => {
                            field.onBlur()
                            extractVariablesFromContent()
                          }} 
                        />
                      </FormControl>
                      <FormDescription>
                        使用 {`{{变量名}}`} 格式插入变量，如 {`{{username}}`}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>推送内容 *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="亲爱的 {{username}}，欢迎使用我们的应用！"
                          className="resize-none"
                          rows={4}
                          {...field}
                          onBlur={() => {
                            field.onBlur()
                            extractVariablesFromContent()
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payload"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>推送载荷 (可选)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder='{"action":"welcome","user_id":"{{user_id}}"}'
                          className="resize-none font-mono text-sm"
                          rows={3}
                          {...field}
                          onBlur={() => {
                            field.onBlur()
                            extractVariablesFromContent()
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        JSON格式的推送载荷，支持变量替换
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 变量定义 (与创建模板相同的逻辑) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">模板变量</h4>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={extractVariablesFromContent}
                    >
                      自动检测
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addVariable}
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      添加变量
                    </Button>
                  </div>
                </div>

                {Object.keys(variables).length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    暂无变量，在模板内容中使用 {`{{变量名}}`} 格式会自动检测
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(variables).map(([name, variable]) => (
                      <div key={name} className="flex items-end gap-3 p-3 border rounded-lg">
                        <div className="flex-1 grid grid-cols-4 gap-3">
                          <div className='flex flex-col gap-2'>
                            <label className="text-sm font-medium">变量名</label>
                            <div>
                              <Badge className='h-8 px-2 border-input' variant="outline">{name}</Badge>
                            </div>
                          </div>
                          <div className='flex flex-col gap-2'>
                            <label className="text-sm font-medium">类型</label>
                            <Select 
                              value={variable.type} 
                              onValueChange={(value) => updateVariable(name, 'type', value)}
                            >
                              <SelectTrigger className="!h-8 w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">字符串</SelectItem>
                                <SelectItem value="number">数字</SelectItem>
                                <SelectItem value="boolean">布尔值</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className='flex flex-col gap-2'>
                            <label className="text-sm font-medium">描述</label>
                            <Input 
                              className="h-8"
                              value={variable.description} 
                              onChange={(e) => updateVariable(name, 'description', e.target.value)}
                              placeholder="变量描述"
                            />
                          </div>
                          <div className='flex flex-col gap-2'>
                            <label className="text-sm font-medium">默认值</label>
                            <Input 
                              className="h-8"
                              value={variable.default || ''} 
                              onChange={(e) => updateVariable(name, 'default', e.target.value)}
                              placeholder="默认值"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removeVariable(name)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
          </Form>
        </div>

        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleClose}
            disabled={loading}
          >
            取消
          </Button>
          <Button 
            onClick={form.handleSubmit(onSubmit)}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
