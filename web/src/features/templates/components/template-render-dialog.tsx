import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Play, Loader2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from '@/components/ui/input'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/auth-store'
import { TemplateService } from '@/services/template-service'
import { toast } from 'sonner'
import type { MessageTemplate, TemplateVariable } from '@/types/api'

interface TemplateRenderDialogProps {
  template: MessageTemplate
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TemplateRenderDialog({ template, open, onOpenChange }: TemplateRenderDialogProps) {
  const { currentApp } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [renderResult, setRenderResult] = useState<{
    title: string
    content: string
    payload?: string
  } | null>(null)

  // 提取模板中的变量
  const extractVariables = (text: string): string[] => {
    const regex = /\{\{\.?([a-zA-Z0-9_]+)\}\}/g
    const variables = new Set<string>()
    let match
    
    while ((match = regex.exec(text)) !== null) {
      variables.add(match[1])
    }
    
    return Array.from(variables)
  }

  const allVariables = [
    ...extractVariables(template.title),
    ...extractVariables(template.content),
    ...(template.payload ? extractVariables(template.payload) : [])
  ]
  const uniqueVariables = Array.from(new Set(allVariables))

  // 创建动态表单
  const form = useForm({
    defaultValues: uniqueVariables.reduce((acc, varName) => {
      acc[varName] = ''
      return acc
    }, {} as Record<string, string>)
  })

  const onSubmit = async (data: Record<string, string>) => {
    if (!currentApp) return

    try {
      setLoading(true)
      const result = await TemplateService.renderTemplate(currentApp.id, template.id, data)
      setRenderResult(result)
      toast.success('模板渲染成功')
    } catch (error) {
      toast.error((error as Error).message || '模板渲染失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyResult = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('内容已复制到剪贴板')
  }

  const resetForm = () => {
    form.reset()
    setRenderResult(null)
  }

  // 解析变量定义
  let variableDefinitions: Record<string, TemplateVariable> = {}
  try {
    variableDefinitions = template.variables ? JSON.parse(template.variables) : {}
  } catch {
    variableDefinitions = {}
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            模板渲染测试
          </DialogTitle>
          <DialogDescription>
            为模板 "{template.name}" 提供变量值，测试渲染效果
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6 space-y-6">
          {/* 变量输入表单 */}
          <div>
            <h3 className="text-lg font-medium mb-4">变量赋值</h3>
            
            {uniqueVariables.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                此模板不包含变量，可以直接预览
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {uniqueVariables.map((varName) => {
                      const definition = variableDefinitions[varName]
                      return (
                        <FormField
                          key={varName}
                          control={form.control}
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
                  
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Play className="mr-2 h-4 w-4" />
                      渲染模板
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      重置
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </div>

          {/* 渲染结果预览 */}
          {(renderResult || uniqueVariables.length === 0) && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-medium mb-4">渲染结果</h3>
                
                {/* 手机样式预览 */}
                <div className="bg-muted p-4 rounded-lg">
                  <div className="bg-background border rounded-lg p-4 max-w-sm mx-auto shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <span className="text-primary-foreground text-sm font-medium">📱</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm leading-tight flex items-center">
                          {renderResult?.title || template.title}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-2 h-4 w-4 p-0"
                            onClick={() => handleCopyResult(renderResult?.title || template.title)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-muted-foreground text-sm mt-1 leading-tight flex items-center">
                          {renderResult?.content || template.content}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-2 h-4 w-4 p-0"
                            onClick={() => handleCopyResult(renderResult?.content || template.content)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2 flex items-center">
                          刚刚 • {template.platform === 'all' ? 'iOS/Android' : template.platform}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 载荷预览 */}
                {(renderResult?.payload || template.payload) && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">推送载荷</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyResult(renderResult?.payload || template.payload || '')}
                      >
                        <Copy className="mr-2 h-3 w-3" />
                        复制
                      </Button>
                    </div>
                    <pre className="text-sm p-3 bg-muted rounded-lg overflow-auto font-mono">
                      {JSON.stringify(
                        JSON.parse((renderResult?.payload || template.payload) || '{}'), 
                        null, 
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
