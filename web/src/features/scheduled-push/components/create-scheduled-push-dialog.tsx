import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Calendar, Clock, Target, MessageCircle } from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth-store'
import { ScheduledPushService } from '@/services/scheduled-push-service'
import { requireApp } from '@/utils/app-utils'
import { toast } from 'sonner'

// 表单验证规则
const createScheduledPushSchema = z.object({
  title: z.string().min(1, '请输入推送标题').max(200, '标题不超过200个字符'),
  content: z.string().min(1, '请输入推送内容').max(1000, '内容不超过1000个字符'),
  payload: z.string().optional(),
  scheduled_at: z.string().min(1, '请选择执行时间'),
  repeat_type: z.enum(['none', 'daily', 'weekly', 'monthly']),
  repeat_config: z.string().optional(),
  timezone: z.string().optional(),
  push_type: z.enum(['single', 'batch', 'broadcast']),
  target_config: z.string().min(1, '请配置推送目标'),
  template_id: z.number().optional(),
})

type CreateScheduledPushFormData = z.infer<typeof createScheduledPushSchema>

interface CreateScheduledPushDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateScheduledPushDialog({ open, onOpenChange, onSuccess }: CreateScheduledPushDialogProps) {
  const { currentApp } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const form = useForm<CreateScheduledPushFormData>({
    resolver: zodResolver(createScheduledPushSchema),
    defaultValues: {
      title: '',
      content: '',
      payload: '',
      scheduled_at: '',
      repeat_type: 'none',
      repeat_config: '',
      timezone: 'Asia/Shanghai',
      push_type: 'broadcast',
      target_config: '',
    },
  })

  const onSubmit = async (data: CreateScheduledPushFormData) => {
    if (!requireApp(currentApp)) {
      return
    }

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
          toast.error('单设备推送目标配置格式错误，请输入设备Token')
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
          toast.error('批量推送目标配置格式错误，请输入有效的设备Token列表')
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

      await ScheduledPushService.createScheduledPush(currentApp.id, requestData)
      toast.success('定时推送创建成功')
      form.reset()
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error((error as Error).message || '创建定时推送失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      form.reset()
      onOpenChange(false)
    }
  }

  const pushType = form.watch('push_type')
  const repeatType = form.watch('repeat_type')

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            创建定时推送
          </DialogTitle>
          <DialogDescription>
            设置定时推送任务，支持单次执行和重复执行
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* 推送内容 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    推送内容
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                        <FormDescription>
                          可选，JSON格式的自定义数据
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* 时间设置 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    时间设置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                          <FormDescription>
                            {repeatType === 'weekly' && '输入周几执行，1-7代表周一到周日'}
                            {repeatType === 'monthly' && '输入每月的哪几号执行，1-31'}
                            {repeatType === 'daily' && '每日重复无需额外配置'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>

              {/* 推送目标 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    推送目标
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="push_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>推送类型 *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                            placeholder={
                              pushType === 'single' ? '输入设备Token' :
                              pushType === 'batch' ? '输入多个设备Token，用逗号分隔' :
                              '输入筛选条件，例如: platform:ios 或 {} (所有设备)'
                            }
                            className="resize-none font-mono text-sm"
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {pushType === 'single' && '输入单个设备Token，自动转换为 [deviceId] 格式'}
                          {pushType === 'batch' && '输入多个设备Token，支持逗号分隔或JSON数组格式'}
                          {pushType === 'broadcast' && '输入筛选条件，支持键值对或JSON格式，空白表示所有设备'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
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
            创建定时推送
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
