import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Clock, Target, MessageCircle, HelpCircle } from 'lucide-react'
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/components/date-time-picker'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth-store'
import { ScheduledPushService } from '@/services/scheduled-push-service'
import { toast } from 'sonner'
import type { ScheduledPush } from '@/types/api'
import { GroupSelector } from '../../push/components/group-selector'

// 表单验证规则
const editScheduledPushSchema = z.object({
  title: z.string().min(1, '请输入推送标题').max(200, '标题不超过200个字符'),
  content: z.string().min(1, '请输入推送内容').max(1000, '内容不超过1000个字符'),
  payload: z.object({
    action: z.string().optional(),
    url: z.string().url('请输入有效的URL').optional().or(z.literal('')),
    data: z.string().optional(),
    // 华为推送特有参数
    huawei: z.object({
      importance: z.enum(['NORMAL', 'LOW']).optional(),
      category: z.string().optional(),
    }).optional(),
    // 小米推送特有参数
    xiaomi: z.object({
      channel_id: z.string().optional(),
      pass_through: z.number().int().min(0).max(1).optional(),
    }).optional(),
    // OPPO推送特有参数（新消息分类系统）
    oppo: z.object({
      category: z.enum(['IM', 'ACCOUNT', 'DEVICE_REMINDER', 'ORDER', 'TODO', 'SUBSCRIPTION', 
                        'NEWS', 'CONTENT', 'MARKETING', 'SOCIAL']).optional(),
      notify_level: z.union([z.literal(1), z.literal(2), z.literal(16)]).optional(),
      channel_id: z.string().optional(),
    }).optional(),
  }).optional(),
  badge: z.number().int('角标必须是整数').min(1, '角标数量必须大于等于1').optional(),
  scheduled_at: z.string().min(1, '请选择执行时间').refine((val) => {
    const scheduledTime = new Date(val);
    const now = new Date();
    return scheduledTime > now;
  }, {
    message: '执行时间必须是未来时间'
  }),
  push_type: z.enum(['single', 'batch', 'broadcast', 'groups']),
  target_config: z.string().optional(),
  group_ids: z.array(z.number()).optional(),
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
      payload: {
        action: '',
        url: '',
        data: '',
        huawei: {
          importance: 'NORMAL',
          category: 'IM',
        },
        xiaomi: {
          channel_id: '',
          pass_through: 0,
        },
        oppo: {
          category: undefined,
          notify_level: 2,
          channel_id: '',
        },
      },
      badge: 1,
      scheduled_at: '',
      push_type: 'broadcast',
      target_config: '',
      group_ids: [],
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

      // 处理分组推送的 group_ids
      let groupIds: number[] = []
      if (push.push_type === 'groups' && push.target_config) {
        try {
          const parsed = JSON.parse(push.target_config)
          if (Array.isArray(parsed)) {
            groupIds = parsed
          }
        } catch (_error) {
          console.warn('Failed to parse target_config for groups:', push.target_config)
        }
      }

      // 解析现有的payload
      let parsedPayload = {
        action: '',
        url: '',
        data: '',
        huawei: {
          importance: 'NORMAL' as const,
          category: 'IM',
        },
        xiaomi: {
          channel_id: '',
          pass_through: 0,
        },
        oppo: {
          category: undefined,
          notify_level: 2 as const,
          channel_id: '',
        },
      }
      
      if (push.payload) {
        try {
          const payloadData = JSON.parse(push.payload)
          parsedPayload = {
            action: payloadData.action || '',
            url: payloadData.url || '',
            data: payloadData.data || '',
            huawei: {
              importance: payloadData.huawei?.importance || 'NORMAL',
              category: payloadData.huawei?.category || 'IM',
            },
            xiaomi: {
              channel_id: payloadData.xiaomi?.channel_id || '',
              pass_through: payloadData.xiaomi?.pass_through || 0,
            },
            oppo: {
              category: payloadData.oppo?.category || undefined,
              notify_level: payloadData.oppo?.notify_level || 2,
              channel_id: payloadData.oppo?.channel_id || '',
            },
          }
        } catch (error) {
          console.warn('Failed to parse payload, using defaults:', error)
        }
      }

      form.reset({
        title: push.title || '',
        content: push.content || '',
        payload: parsedPayload,
        badge: push.badge || 1,
        scheduled_at: getFormattedScheduledAt(),
        push_type: push.push_type || 'broadcast',
        target_config: push.push_type === 'groups' ? '' : (push.target_config || ''),
        group_ids: groupIds,
        repeat_type: getFrontendRepeatType(push.repeat_type || 'once'),
        repeat_config: push.repeat_config || '',
        timezone: push.timezone || 'Asia/Shanghai',
        status: push.status || 'pending',
      })
    }
  }, [push, form])

  // 保存用户在不同推送类型下的输入值
  const [userInputs, setUserInputs] = useState<{
    single: string
    batch: string
    broadcast: string
    groups: number[]
  }>({
    single: '',
    batch: '',
    broadcast: '',
    groups: []
  })

  // 当推送数据变化时，初始化用户输入值
  useEffect(() => {
    if (push) {
      if (push.push_type === 'groups' && push.target_config) {
        try {
          const parsed = JSON.parse(push.target_config)
          if (Array.isArray(parsed)) {
            setUserInputs(prev => ({
              ...prev,
              groups: parsed
            }))
          }
        } catch (_error) {
          console.warn('Failed to parse target_config for groups:', push.target_config)
        }
      } else {
        setUserInputs(prev => ({
          ...prev,
          [push.push_type]: push.target_config || ''
        }))
      }
    }
  }, [push])

  // 跟踪上一个推送类型
  const [previousPushType, setPreviousPushType] = useState<string | null>(null)

  // 监听推送类型变化，智能切换目标配置
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'push_type') {
        const currentPushType = value.push_type
        
        if (currentPushType && currentPushType !== previousPushType) {
          // 先保存当前推送类型下的用户输入
          const updatedUserInputs = { ...userInputs }
          
          if (previousPushType === 'groups') {
            const currentGroupIds = form.getValues('group_ids') || []
            updatedUserInputs.groups = currentGroupIds
          } else if (previousPushType && previousPushType !== 'groups') {
            const currentTargetConfig = form.getValues('target_config') || ''
            updatedUserInputs[previousPushType as 'single' | 'batch' | 'broadcast'] = currentTargetConfig
          }
          
          // 更新状态
          setUserInputs(updatedUserInputs)

          // 使用 setTimeout 确保状态更新后再设置表单值
          setTimeout(() => {
            if (currentPushType === 'groups') {
              form.setValue('target_config', '')
              form.setValue('group_ids', updatedUserInputs.groups)
            } else {
              const targetConfigValue = updatedUserInputs[currentPushType as 'single' | 'batch' | 'broadcast'] || ''
              form.setValue('group_ids', [])
              form.setValue('target_config', targetConfigValue)
            }
          }, 0)
          
          // 更新 previousPushType
          setPreviousPushType(currentPushType)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [form, userInputs, previousPushType])

  // 初始化 previousPushType
  useEffect(() => {
    if (push && push.push_type) {
      setPreviousPushType(push.push_type)
    }
  }, [push])

  const onSubmit = async (data: EditScheduledPushFormData) => {
    if (!currentApp) return

    try {
      setLoading(true)
      
      // 格式化 target_config 字段根据推送类型
      let formattedTargetConfig = (data.target_config || '').trim()
      
      if (data.push_type === 'single') {
        // 单设备推送：支持设备token格式
        try {
          // 如果用户输入的是JSON数组格式，验证格式
          if (formattedTargetConfig.startsWith('[') && formattedTargetConfig.endsWith(']')) {
            JSON.parse(formattedTargetConfig)
          } else if (formattedTargetConfig.includes(',')) {
            // 逗号分隔的多个token，转换为JSON数组格式
            const tokens = formattedTargetConfig.split(',').map(token => token.trim()).filter(token => token)
            formattedTargetConfig = JSON.stringify(tokens)
          } else {
            // 单个token，转换为JSON数组格式
            formattedTargetConfig = JSON.stringify([formattedTargetConfig])
          }
          // 验证JSON格式
          JSON.parse(formattedTargetConfig)
        } catch {
          toast.error('单设备推送目标配置格式错误，请输入设备Token')
          return
        }
      } else if (data.push_type === 'batch') {
        // 批量推送：支持设备token格式
        try {
          if (formattedTargetConfig.startsWith('[') && formattedTargetConfig.endsWith(']')) {
            // 已经是JSON数组格式，验证格式
            JSON.parse(formattedTargetConfig)
          } else if (formattedTargetConfig.includes(',')) {
            // 逗号分隔的多个token，转换为JSON数组格式
            const tokens = formattedTargetConfig.split(',').map(token => token.trim()).filter(token => token)
            formattedTargetConfig = JSON.stringify(tokens)
          } else {
            // 单个token，转换为JSON数组格式
            formattedTargetConfig = JSON.stringify([formattedTargetConfig])
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
      } else if (data.push_type === 'groups') {
        // 分组推送：将 group_ids 转换为 target_config
        if (!data.group_ids || data.group_ids.length === 0) {
          toast.error('请选择至少一个设备分组')
          return
        }
        formattedTargetConfig = JSON.stringify(data.group_ids)
      }

      // 转换payload格式
      let finalPayload = ''
      if (data.payload && (data.payload.action || data.payload.url || data.payload.data || data.payload.huawei || data.payload.xiaomi || data.payload.oppo)) {
        finalPayload = JSON.stringify(data.payload)
      }

      // 创建请求数据
      const requestData = {
        ...data,
        payload: finalPayload,
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
  const pushType = form.watch('push_type')

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="md:max-w-[700px] lg:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
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
                </CardContent>
              </Card>

              {/* 推送载荷 (可选) */}
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <h4 className='font-medium'>推送载荷 (可选)</h4>
                  <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
                    <FormField
                      control={form.control}
                      name="badge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='flex items-center gap-1'>
                            角标数量
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                设置推送消息的角标数量，iOS平台原生支持，Android平台支持情况因厂商而异，必须为大于等于1的整数
                              </TooltipContent>
                            </Tooltip>
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              min="1"
                              step="1"
                              placeholder="输入角标数量"
                              {...field}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 1
                                field.onChange(value >= 1 ? value : 1)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payload.action"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>动作类型</FormLabel>
                          <FormControl>
                            <Input placeholder="open_page" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payload.url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>跳转链接</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payload.data"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>额外数据</FormLabel>
                          <FormControl>
                            <Input placeholder='{"key":"value"}' {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* 高级参数 (厂商特殊参数) */}
                  <Accordion type="single" collapsible className='border rounded-lg'>
                    <AccordionItem value="advanced-settings" className='border-none'>
                      <AccordionTrigger className='px-4 py-3 hover:no-underline'>
                        <div className='flex items-center gap-2'>
                          <span className='text-slate-600'>⚙️</span>
                          <span className='font-medium'>高级参数</span>
                          <span className='text-xs text-muted-foreground ml-2'>厂商特殊配置</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className='p-4 space-y-6'>
                        {/* 华为推送优化 */}
                        <div className='space-y-4'>
                          <div className='flex items-center gap-2 pb-2 border-b'>
                            <span className='text-orange-600'>📱</span>
                            <h6 className='font-medium'>华为推送优化</h6>
                          </div>
                          <div className='grid items-start grid-cols-1 md:grid-cols-2 gap-4'>
                            <FormField
                              control={form.control}
                              name="payload.huawei.importance"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className='flex items-center gap-1'>
                                    消息分类 (importance)
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <div className='space-y-1 text-sm'>
                                            <p><strong>NORMAL</strong>: 服务与通讯类消息，不受频控限制（推荐使用）</p>
                                            <p><strong>LOW</strong>: 资讯营销类消息，受频控限制</p>
                                          </div>
                                        </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>
                                  <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="NORMAL">NORMAL (推荐)</SelectItem>
                                      <SelectItem value="LOW">LOW</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="payload.huawei.category"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className='flex items-center gap-1'>
                                    自定义分类 (category)
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <div className='space-y-1 text-sm'>
                                            <p><strong>IM</strong>: 即时通讯</p>
                                            <p><strong>VOIP</strong>: 语音通话</p>
                                            <p><strong>TRAVEL</strong>: 旅游服务</p>
                                            <p><strong>NEWS</strong>: 新闻资讯</p>
                                            <p><strong>FINANCE</strong>: 金融服务</p>
                                            <p><strong>SOCIAL</strong>: 社交应用</p>
                                            <p className="text-amber-600">需要先在华为开发者后台申请对应权益</p>
                                          </div>
                                        </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>
                                  <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="IM">IM</SelectItem>
                                      <SelectItem value="VOIP">VOIP</SelectItem>
                                      <SelectItem value="TRAVEL">TRAVEL</SelectItem>
                                      <SelectItem value="NEWS">NEWS</SelectItem>
                                      <SelectItem value="FINANCE">FINANCE</SelectItem>
                                      <SelectItem value="SOCIAL">SOCIAL</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* 小米推送优化 */}
                        <div className='space-y-4'>
                          <div className='flex items-center gap-2 pb-2 border-b'>
                            <span className='text-blue-600'>📱</span>
                            <h6 className='font-medium'>小米推送优化</h6>
                          </div>
                          <div className='grid items-start grid-cols-1 md:grid-cols-2 gap-4'>
                            <FormField
                              control={form.control}
                              name="payload.xiaomi.channel_id"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className='flex items-center gap-1'>
                                    推送通道 (channel_id)
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <div className='space-y-1 text-sm'>
                                            <p><strong>默认通道</strong>: 单设备单日1条限制</p>
                                            <p><strong>公信消息</strong>: 单设备单日5-8条限制（需申请）</p>
                                            <p><strong>私信消息</strong>: 不限量（需申请）</p>
                                            <p className="text-blue-600">指定推送通道ID，用于突破默认通道的数量限制</p>
                                            <p>不填写则使用默认通道</p>
                                          </div>
                                        </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="例如：private_msg_channel"
                                      {...field} 
                                    />
                                    </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="payload.xiaomi.pass_through"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className='flex items-center gap-1'>
                                    消息类型 (pass_through)
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <div className='space-y-1 text-sm'>
                                            <p><strong>0</strong>: 通知消息（显示在通知栏，推荐使用）</p>
                                            <p><strong>1</strong>: 透传消息（直接传递给应用）</p>
                                          </div>
                                        </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>
                                  <Select value={field.value?.toString() || '0'} onValueChange={(value) => field.onChange(parseInt(value))}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="0">通知消息 (推荐)</SelectItem>
                                      <SelectItem value="1">透传消息</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* OPPO推送优化 */}
                        <div className='space-y-4'>
                          <div className='flex items-center gap-2 pb-2 border-b'>
                            <span className='text-green-600'>📱</span>
                            <h6 className='font-medium'>OPPO推送优化</h6>
                          </div>
                          <div className='grid items-start grid-cols-1 md:grid-cols-3 gap-4'>
                            <FormField
                              control={form.control}
                              name="payload.oppo.category"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className='flex items-center gap-1'>
                                    消息分类 (category)
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <div className='space-y-2 text-sm max-w-xs'>
                                            <p><strong>通讯与服务类：</strong></p>
                                            <p>• <strong>IM</strong>: 聊天消息、通话</p>
                                            <p>• <strong>ACCOUNT</strong>: 账号资产变化</p>
                                            <p>• <strong>ORDER</strong>: 订单物流状态</p>
                                            <p>• <strong>TODO</strong>: 日程待办</p>
                                            <p><strong>内容与营销类：</strong></p>
                                            <p>• <strong>MARKETING</strong>: 平台活动</p>
                                            <p>• <strong>CONTENT</strong>: 内容推荐</p>
                                            <p>• <strong>NEWS</strong>: 新闻资讯</p>
                                            <p>• <strong>SOCIAL</strong>: 社交动态</p>
                                            <p className="text-green-600">选择适合的消息分类以获得最佳推送体验</p>
                                          </div>
                                        </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>
                                  <Select value={field.value || ''} onValueChange={(value) => field.onChange(value || undefined)}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="选择消息分类" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">通讯与服务类</div>
                                      <SelectItem value="IM">IM - 即时聊天通话</SelectItem>
                                      <SelectItem value="ACCOUNT">ACCOUNT - 账号资产变化</SelectItem>
                                      <SelectItem value="DEVICE_REMINDER">DEVICE_REMINDER - 设备提醒</SelectItem>
                                      <SelectItem value="ORDER">ORDER - 订单物流状态</SelectItem>
                                      <SelectItem value="TODO">TODO - 日程待办</SelectItem>
                                      <SelectItem value="SUBSCRIPTION">SUBSCRIPTION - 个人订阅</SelectItem>
                                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">内容与营销类</div>
                                      <SelectItem value="NEWS">NEWS - 新闻资讯</SelectItem>
                                      <SelectItem value="CONTENT">CONTENT - 内容推荐</SelectItem>
                                      <SelectItem value="MARKETING">MARKETING - 平台活动</SelectItem>
                                      <SelectItem value="SOCIAL">SOCIAL - 社交动态</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="payload.oppo.notify_level"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className='flex items-center gap-1'>
                                    提醒等级 (notify_level)
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <div className='space-y-1 text-sm'>
                                            <p><strong>1</strong>: 仅通知栏显示</p>
                                            <p><strong>2</strong>: 通知栏 + 锁屏显示（推荐默认）</p>
                                            <p><strong>16</strong>: 强提醒（横幅+震动+铃声，需申请权限）</p>
                                          </div>
                                        </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>
                                  <Select value={field.value?.toString() || '2'} onValueChange={(value) => field.onChange(parseInt(value))}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="1">1 - 仅通知栏</SelectItem>
                                      <SelectItem value="2">2 - 通知栏+锁屏 (推荐)</SelectItem>
                                      <SelectItem value="16">16 - 强提醒 (需申请权限)</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="payload.oppo.channel_id"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className='flex items-center gap-1'>
                                    通道ID (channel_id)
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <div className='space-y-1 text-sm max-w-sm'>
                                          <p><strong>指定下发的通道ID</strong></p>
                                          <p>• 自定义通知渠道的唯一标识</p>
                                          <p>• 用于控制推送消息的展示方式和优先级</p>
                                          <p>• 需要与应用端创建的NotificationChannel的ID对应</p>
                                          <p>• 留空则使用默认通道</p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="例如：high_priority_channel"
                                      {...field} 
                                    />
                                    </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>

              {/* 时间设置 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
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
                          <SelectItem value="groups">分组推送</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {pushType === 'groups' ? (
                  <FormField
                    control={form.control}
                    name="group_ids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>选择设备分组 *</FormLabel>
                        <FormControl>
                          <GroupSelector
                            value={field.value || []}
                            onChange={field.onChange}
                            appId={currentApp?.id || 0}
                          />
                        </FormControl>
                        <FormDescription>
                          选择要推送的设备分组，支持多选
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
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
                )}

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
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
