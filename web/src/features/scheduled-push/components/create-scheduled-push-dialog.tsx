import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Calendar, Clock, Target, MessageCircle, HelpCircle } from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth-store'
import { ScheduledPushService } from '@/services/scheduled-push-service'
import { requireApp } from '@/utils/app-utils'
import { toast } from 'sonner'
import { GroupSelector } from '../../push/components/group-selector'
import { TemplateSelector } from '@/components/template-selector'

// 表单验证规则
const createScheduledPushSchema = z.object({
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
    // VIVO推送特有参数
    vivo: z.object({
      classification: z.union([z.literal(0), z.literal(1)]).optional(),
      notify_type: z.union([z.literal(1), z.literal(2)]).optional(),
      skip_type: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      skip_content: z.string().optional(),
      network_type: z.union([z.literal(-1), z.literal(1)]).optional(),
      time_to_live: z.number().int().min(1).max(86400 * 7).optional(),
      client_custom_map: z.record(z.string()).optional(),
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
  repeat_type: z.enum(['none', 'daily', 'weekly', 'monthly']),
  repeat_config: z.string().optional(),
  timezone: z.string().optional(),
  push_type: z.enum(['single', 'batch', 'broadcast', 'groups']),
  target_config: z.string().optional(),
  group_ids: z.array(z.number()).optional(),
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>()

  const form = useForm<CreateScheduledPushFormData>({
    resolver: zodResolver(createScheduledPushSchema),
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
        vivo: {
          classification: 0,
          notify_type: 1,
          skip_type: 1,
          skip_content: '',
          network_type: -1,
          time_to_live: 86400,
          client_custom_map: {},
        },
      },
      badge: 1,
      scheduled_at: '',
      repeat_type: 'none',
      repeat_config: '',
      timezone: 'Asia/Shanghai',
      push_type: 'broadcast',
      target_config: '',
      group_ids: [],
    },
  })

  const onSubmit = async (data: CreateScheduledPushFormData) => {
    if (!requireApp(currentApp)) {
      return
    }

    try {
      setLoading(true)
      
      // 转换payload格式
      let finalPayload = ''
      if (data.payload && (data.payload.action || data.payload.url || data.payload.data || data.payload.huawei || data.payload.xiaomi || data.payload.oppo || data.payload.vivo)) {
        finalPayload = JSON.stringify(data.payload)
      }
      
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
      } else if (data.push_type === 'groups') {
        // 分组推送：验证分组ID
        if (!data.group_ids || data.group_ids.length === 0) {
          toast.error('请选择至少一个设备分组')
          return
        }
        // 分组推送不需要 target_config，使用 group_ids
        formattedTargetConfig = JSON.stringify(data.group_ids)
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
        payload: finalPayload,
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
      <DialogContent className="md:max-w-[700px] lg:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
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
                  {/* 模板选择器 */}
                  <FormItem>
                    <FormLabel>消息模板 (可选)</FormLabel>
                    <FormControl>
                      <TemplateSelector
                        value={selectedTemplateId}
                        onValueChange={setSelectedTemplateId}
                        onTemplateApply={(template) => {
                          form.setValue('title', template.title)
                          form.setValue('content', template.content)
                          toast.success('模板应用成功')
                        }}
                        platform="all"
                      />
                    </FormControl>
                    <FormDescription>
                      选择预设的消息模板快速填充标题和内容，支持变量替换
                    </FormDescription>
                  </FormItem>

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

                  {/* 推送载荷 (可选) */}
                  <div className='space-y-4'>
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
                  </div>
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
                  <div className="grid items-start grid-cols-2 gap-4">
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
                            {pushType === 'single' && '输入单个设备Token，自动转换为 [Token] 格式'}
                            {pushType === 'batch' && '输入多个设备Token，支持逗号分隔或JSON数组格式'}
                            {pushType === 'broadcast' && '输入筛选条件，支持键值对或JSON格式，空白表示所有设备'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
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
