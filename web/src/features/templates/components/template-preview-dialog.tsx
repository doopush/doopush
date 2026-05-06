import { Eye, Smartphone } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogScrollBody,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { MessageTemplate, TemplateVariable } from '@/types/api'

interface TemplatePreviewDialogProps {
  template: MessageTemplate
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TemplatePreviewDialog({ template, open, onOpenChange }: TemplatePreviewDialogProps) {
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

  // 解析变量定义
  let variableDefinitions: Record<string, TemplateVariable> = {}
  try {
    variableDefinitions = template.variables ? JSON.parse(template.variables) : {}
  } catch {
    variableDefinitions = {}
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            模板预览
          </DialogTitle>
        </DialogHeader>

        <DialogScrollBody className="space-y-6">
          {/* 基本信息 */}
          <div>
            <h3 className="text-lg font-medium mb-4">基本信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">模板名称:</span>
                  <span className="text-sm font-medium">{template.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">版本:</span>
                  <span className="text-sm font-medium">v{template.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">语言:</span>
                  <span className="text-sm font-medium">{template.locale}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">支持平台:</span>
                  <Badge className={getPlatformBadge(template.platform)}>
                    {template.platform === 'all' ? '全平台' : template.platform.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">状态:</span>
                  <Badge className={getStatusBadge(template.is_active).className}>
                    {getStatusBadge(template.is_active).label}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">创建时间:</span>
                  <span className="text-sm font-medium">
                    {new Date(template.created_at).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 消息内容预览 */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              推送内容预览
            </h3>
            
            {/* 手机样式预览 */}
            <div className="bg-muted p-4 rounded-lg">
              <div className="bg-background border rounded-lg p-4 max-w-sm mx-auto shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-primary-foreground text-sm font-medium">📱</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm leading-tight">
                      {template.title}
                    </div>
                    <div className="text-muted-foreground text-sm mt-1 leading-tight">
                      {template.content}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      刚刚 • {template.platform === 'all' ? 'iOS/Android' : template.platform}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-muted-foreground">
              <strong>注意:</strong> 实际推送显示效果可能因设备型号和系统版本而异
            </div>
          </div>

          <Separator />

          {/* 模板变量 */}
          {uniqueVariables.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4">模板变量</h3>
              <div className="space-y-3">
                {uniqueVariables.map((variableName) => {
                  const definition = variableDefinitions[variableName]
                  return (
                    <div key={variableName} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{variableName}</Badge>
                        <div>
                          <div className="text-sm font-medium">
                            {definition?.description || `变量 ${variableName}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            类型: {definition?.type || 'string'}
                            {definition?.default && ` • 默认值: ${definition.default}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 推送载荷 */}
          {template.payload && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-medium mb-4">推送载荷</h3>
                <pre className="text-sm p-3 bg-muted rounded-lg overflow-auto font-mono">
                  {JSON.stringify(JSON.parse(template.payload || '{}'), null, 2)}
                </pre>
              </div>
            </>
          )}
        </DialogScrollBody>
      </DialogContent>
    </Dialog>
  )
}
