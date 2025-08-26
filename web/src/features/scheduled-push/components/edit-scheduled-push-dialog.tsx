import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
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
import { DateTimePicker } from '@/components/date-time-picker'

import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import { ScheduledPushService } from '@/services/scheduled-push-service'
import { toast } from 'sonner'
import type { ScheduledPush } from '@/types/api'

// 表单验证规则
const editScheduledPushSchema = z.object({
  title: z.string().min(1, '请输入推送标题').max(200, '标题不超过200个字符'),
  content: z.string().min(1, '请输入推送内容').max(1000, '内容不超过1000个字符'),
  payload: z.string().optional(),
  scheduled_at: z.string().min(1, '请选择执行时间'),
  push_type: z.enum(['single', 'batch', 'broadcast']),
  target_config: z.string().min(1, '请配置推送目标'),
  repeat_type: z.enum(['none', 'daily', 'weekly', 'monthly']),
  repeat_config: z.string().optional(),
  timezone: z.string().optional(),
  status: z.enum(['pending', 'running', 'paused', 'completed', 'failed']),
})

type EditScheduledPushFormData = z.infer<typeof editScheduledPushSchema>

interface EditScheduledPushDialogProps {
  push: ScheduledPush
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditScheduledPushDialog({ push, open, onOpenChange, onSuccess }: EditScheduledPushDialogProps) {
  const { currentApp } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const form = useForm<EditScheduledPushFormData>({
    resolver: zodResolver(editScheduledPushSchema),
    defaultValues: {
      title: '',
      content: '',
      payload: '',
      scheduled_at: '',
      push_type: 'broadcast',
      target_config: '',
      repeat_type: 'none',
      repeat_config: '',
      timezone: 'Asia/Shanghai',
      status: 'pending',
    },
  })

  // 当推送数据变化时更新表单
  useEffect(() => {
    if (push) {
      // 安全地处理时间字段
      const getFormattedScheduledAt = () => {
        if (!push.scheduled_at) return ''
        try {
          const date = new Date(push.scheduled_at)
          return isNaN(date.getTime()) ? '' : date.toISOString()
        } catch (_error) {
          console.warn('Invalid scheduled_at value:', push.scheduled_at)
          return ''
        }
      }

      // 转换后端的repeat_type: "once" -> 前端的"none"
      const getFrontendRepeatType = (backendRepeatType: string) => {
        if (backendRepeatType === 'once') return 'none'
        return backendRepeatType as 'none' | 'daily' | 'weekly' | 'monthly'
      }

      form.reset({
        title: push.title || '',
        content: push.content || '',
        payload: push.payload || '',
        scheduled_at: getFormattedScheduledAt(),
        push_type: push.push_type || 'broadcast',
        target_config: push.target_config || '',
        repeat_type: getFrontendRepeatType(push.repeat_type || 'once'),
        repeat_config: push.repeat_config || '',
        timezone: push.timezone || 'Asia/Shanghai',
        status: push.status || 'pending',
      })
    }
  }, [push, form])

  const onSubmit = async (data: EditScheduledPushFormData) => {
    if (!currentApp) return

    try {
      setLoading(true)
      
      // 格式化 target_config 字段根据推送类型
      let formattedTargetConfig = data.target_config.trim()
      
      if (data.push_type === 'single') {
        // 单设备推送：确保是 [deviceId] 格式
        try {
          // 如果用户输入的是数字，转换为数组格式
          if (/^\d+$/.test(formattedTargetConfig)) {
            formattedTargetConfig = `[${formattedTargetConfig}]`
          } else if (!formattedTargetConfig.startsWith('[')) {
            // 如果不是数组格式，尝试转换
            formattedTargetConfig = `[${formattedTargetConfig}]`
          }
          // 验证JSON格式
          JSON.parse(formattedTargetConfig)
        } catch {
          toast.error('单设备推送目标配置格式错误，请输入设备ID')
          return
        }
      } else if (data.push_type === 'batch') {
        // 批量推送：确保是 [id1,id2,id3] 格式
        try {
          if (formattedTargetConfig.includes(',') && !formattedTargetConfig.startsWith('[')) {
            // 逗号分隔的ID列表，转换为数组
            const ids = formattedTargetConfig.split(',').map(id => id.trim()).filter(id => id)
            formattedTargetConfig = JSON.stringify(ids.map(id => /^\d+$/.test(id) ? parseInt(id, 10) : id))
          } else if (!formattedTargetConfig.startsWith('[')) {
            // 单个ID，转换为数组
            if (/^\d+$/.test(formattedTargetConfig)) {
              formattedTargetConfig = `[${parseInt(formattedTargetConfig, 10)}]`
            } else {
              formattedTargetConfig = `[${formattedTargetConfig}]`
            }
          }
          // 验证JSON格式
          JSON.parse(formattedTargetConfig)
        } catch {
          toast.error('批量推送目标配置格式错误，请输入有效的设备ID列表')
          return
        }
      } else if (data.push_type === 'broadcast') {
        // 广播推送：确保是 {} 或有效的JSON对象格式
        try {
          if (formattedTargetConfig === '' || formattedTargetConfig === 'all') {
            formattedTargetConfig = '{}'
          } else if (!formattedTargetConfig.startsWith('{')) {
            // 简单的键值对转换
            if (formattedTargetConfig.includes(':')) {
              const pairs = formattedTargetConfig.split(',').map(pair => {
                const [key, value] = pair.split(':').map(s => s.trim())
                return `"${key}":"${value}"`
              })
              formattedTargetConfig = `{${pairs.join(',')}}`
            } else {
              formattedTargetConfig = '{}'
            }
          }
          // 验证JSON格式
          JSON.parse(formattedTargetConfig)
        } catch {
          toast.error('广播推送目标配置格式错误，请输入有效的JSON配置')
          return
        }
      }

      // 创建请求数据
      const requestData = {
        ...data,
        target_config: formattedTargetConfig
      }

      await ScheduledPushService.updateScheduledPush(currentApp.id, push.id, requestData)
      toast.success('定时推送更新成功')
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error((error as Error).message || '更新定时推送失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
    }
  }

  const repeatType = form.watch('repeat_type')

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>编辑定时推送</DialogTitle>
          <DialogDescription>
            修改定时推送任务的配置
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6">
          {/* 任务信息显示 */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">任务 #{push.id}</div>
                <div className="text-sm text-muted-foreground">
                  创建于 {new Date(push.created_at).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              <Badge 
                variant={push.status === 'pending' ? 'secondary' : 
                        push.status === 'running' ? 'default' : 
                        push.status === 'completed' ? 'secondary' : 'outline'}
                className={push.status === 'failed' ? 'text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' : ''}
              >
                {push.status === 'pending' ? '等待中' :
                 push.status === 'running' ? '运行中' :
                 push.status === 'paused' ? '已暂停' :
                 push.status === 'completed' ? '已完成' : '失败'}
              </Badge>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* 推送内容 */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>推送标题 *</FormLabel>
                      <FormControl>
                        <Input placeholder="输入推送标题" {...field} />
                      </FormControl>
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
                          placeholder="输入推送内容"
                          className="resize-none"
                          rows={4}
                          {...field}
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
                      <FormLabel>附加数据</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="JSON格式的附加数据"
                          className="resize-none font-mono text-sm"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 时间设置 */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduled_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>执行时间 *</FormLabel>
                        <FormControl>
                          <DateTimePicker
                            value={field.value ? new Date(field.value) : undefined}
                            onChange={(date: Date | undefined) => field.onChange(date ? date.toISOString() : '')}
                            placeholder="选择执行时间"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>时区</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择时区" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Asia/Shanghai">北京时间 (UTC+8)</SelectItem>
                            <SelectItem value="UTC">协调世界时 (UTC)</SelectItem>
                            <SelectItem value="America/New_York">纽约时间 (UTC-5)</SelectItem>
                            <SelectItem value="Europe/London">伦敦时间 (UTC+0)</SelectItem>
                            <SelectItem value="Asia/Tokyo">东京时间 (UTC+9)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="repeat_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>重复类型 *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择重复类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">单次执行</SelectItem>
                          <SelectItem value="daily">每日重复</SelectItem>
                          <SelectItem value="weekly">每周重复</SelectItem>
                          <SelectItem value="monthly">每月重复</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {repeatType !== 'none' && (
                  <FormField
                    control={form.control}
                    name="repeat_config"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>重复配置</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={
                              repeatType === 'weekly' ? '例如: 1,3,5 (周一、三、五)' :
                              repeatType === 'monthly' ? '例如: 1,15 (每月1号和15号)' :
                              '重复执行的具体配置'
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* 推送目标 */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="push_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>推送类型 *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择推送类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">单设备推送</SelectItem>
                          <SelectItem value="batch">批量推送</SelectItem>
                          <SelectItem value="broadcast">广播推送</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="target_config"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>目标配置 *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="推送目标的配置"
                          className="resize-none font-mono text-sm"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 状态控制 */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>任务状态</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择任务状态" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">等待中</SelectItem>
                        <SelectItem value="paused">已暂停</SelectItem>
                        <SelectItem value="completed">已完成</SelectItem>
                        <SelectItem value="failed">失败</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      可以更改任务状态，运行中状态不可编辑
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
