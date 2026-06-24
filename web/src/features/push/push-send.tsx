import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  Send, 
  Tag,
  Smartphone, 
  Loader2,
  Clock,
  UserCheck,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/components/date-time-picker'


import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { GroupSelector } from './components/group-selector'

import { useAuthStore } from '@/stores/auth-store'
import { PushService } from '@/services/push-service'
import { ScheduledPushService } from '@/services/scheduled-push-service'
import { NoAppSelected } from '@/components/no-app-selected'
import { TagSelector } from '@/components/tag-selector'
import { TemplateSelector } from '@/components/template-selector'
import { requireApp, APP_SELECTION_DESCRIPTIONS } from '@/utils/app-utils'
import { toast } from 'sonner'
import { useLocation } from '@tanstack/react-router'
import { ANDROID_VENDOR_OPTIONS, ANDROID_MESSAGE_CATEGORY_GROUPS, ANDROID_MESSAGE_CATEGORY_VALUES } from '@/lib/constants'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// 推送表单验证规则
const pushFormSchema = z.object({
  title: z.string().min(1, '推送标题不能为空').max(200, '标题不能超过200个字符'),
  content: z.string().min(1, '推送内容不能为空').max(1000, '内容不能超过1000个字符'),
  badge: z.number().int('角标必须是整数').min(1, '角标数量必须大于等于1').optional(),
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
      category: z.enum(ANDROID_MESSAGE_CATEGORY_VALUES).optional(),
    }).optional(),
    // 魅族推送特有参数
    meizu: z.object({
      notice_msg_type: z.union([z.literal(0), z.literal(1)]).optional(),
      notice_bar_type: z.union([z.literal(0), z.literal(2)]).optional(),
      notice_expand_type: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
      notice_expand_content: z.string().optional(),
      notice_expand_img_url: z.string().url('请输入有效的图片URL').optional().or(z.literal('')),
      click_type: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
      activity: z.string().optional(),
      url: z.string().url('请输入有效的URL').optional().or(z.literal('')),
      parameters: z.record(z.string(), z.unknown()).optional(),
      custom_attribute: z.string().optional(),
      off_line: z.union([z.literal(0), z.literal(1)]).optional(),
      valid_time: z.number().int().min(1).max(72).optional(),
      suspend: z.union([z.literal(0), z.literal(1)]).optional(),
      clear_notice_bar: z.union([z.literal(0), z.literal(1)]).optional(),
      notify_key: z.string().optional(),
      vibrate: z.union([z.literal(0), z.literal(1)]).optional(),
      lights: z.union([z.literal(0), z.literal(1)]).optional(),
      sound: z.union([z.literal(0), z.literal(1)]).optional(),
      subtitle: z.string().optional(),
      pull_down_top: z.union([z.literal(0), z.literal(1)]).optional(),
      time_top: z.number().int().min(1800).max(7200).optional(),
      not_group: z.union([z.literal(0), z.literal(1)]).optional(),
      title_color: z.string().optional(),
      background_img_url: z.string().url('请输入有效的图片URL').optional().or(z.literal('')),
      small_icon_url: z.string().url('请输入有效的图标URL').optional().or(z.literal('')),
      big_icon_url: z.string().url('请输入有效的图标URL').optional().or(z.literal('')),
      callback: z.string().url('请输入有效的回调URL').optional().or(z.literal('')),
      callback_param: z.string().optional(),
      callback_type: z.enum(['1', '2', '3']).optional(),
    }).optional(),
    // 荣耀推送特有参数
    honor: z.object({
      importance: z.enum(['NORMAL', 'HIGH']).optional(),
      ttl: z.string().optional(),
      target_user_type: z.union([z.literal(0), z.literal(1)]).optional(),
    }).optional(),
  }).optional(),
  target_type: z.enum(['single', 'batch', 'tags', 'broadcast', 'groups']).refine(val => val, {
    message: '请选择推送类型',
  }),
  device_ids: z.string().optional(),
  tags: z.array(z.object({
    tag_name: z.string().min(1, '标签名称不能为空'),
    tag_value: z.string().optional(),
  })).optional(),
  group_ids: z.array(z.number()).optional(),
  platform: z.string().optional(),
  vendor: z.string().optional(),
  push_environment: z.enum(['development', 'production']).optional(),
  schedule_time: z.string().optional().refine((val) => {
    if (!val) return true; // 可选字段，空值通过验证
    const scheduledTime = new Date(val);
    const now = new Date();
    return scheduledTime > now;
  }, {
    message: '定时发送时间必须是未来时间'
  }),
})

type PushFormData = z.infer<typeof pushFormSchema>

export default function PushSend() {
  const { currentApp } = useAuthStore()
  const location = useLocation()
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState('single')
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>()

  const form = useForm<PushFormData>({
    resolver: zodResolver(pushFormSchema),
    defaultValues: {
      title: '',
      content: '',
      badge: 1,
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
          category: undefined,
        },
        meizu: {
          notice_msg_type: 0,
          notice_bar_type: 0,
          notice_expand_type: 0,
          notice_expand_content: '',
          notice_expand_img_url: '',
          click_type: 0,
          activity: '',
          url: '',
          parameters: {},
          custom_attribute: '',
          off_line: 1,
          valid_time: 24,
          suspend: 0,
          clear_notice_bar: 1,
          notify_key: '',
          vibrate: 1,
          lights: 1,
          sound: 1,
          subtitle: '',
          pull_down_top: 0,
          time_top: 3600,
          not_group: 0,
          title_color: '',
          background_img_url: '',
          small_icon_url: '',
          big_icon_url: '',
          callback: '',
          callback_param: '',
          callback_type: '3',
        },
        honor: {
          importance: 'NORMAL',
          ttl: '86400s',
          target_user_type: 0,
        },
      },
      target_type: 'single',
      device_ids: '',
      tags: [],
      platform: '',
      vendor: '',
      push_environment: undefined,
      schedule_time: '',
    },
  })

  // 处理复用数据回填
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const reuseParam = searchParams.get('reuse')
    
    if (reuseParam) {
      try {
        const reuseData = JSON.parse(decodeURIComponent(reuseParam))
        
        // 设置表单数据
        form.setValue('title', reuseData.title || '')
        form.setValue('content', reuseData.content || '')
        
        // 设置角标数量
        if (reuseData.badge !== undefined) {
          form.setValue('badge', reuseData.badge)
        }
        
        // 处理payload数据
        if (reuseData.payload) {
          const payload = typeof reuseData.payload === 'string' 
            ? JSON.parse(reuseData.payload) 
            : reuseData.payload
          form.setValue('payload.action', payload.action || '')
          form.setValue('payload.url', payload.url || '')
          form.setValue('payload.data', payload.data || '')
          
          // 处理华为特有参数
          if (payload.huawei) {
            form.setValue('payload.huawei.importance', payload.huawei.importance || 'NORMAL')
            form.setValue('payload.huawei.category', payload.huawei.category || 'IM')
          }

          // 处理 vivo 特有参数
          form.setValue('payload.vivo.category', payload.vivo?.category || undefined)

          // 处理魅族特有参数
          if (payload.meizu) {
            form.setValue('payload.meizu.notice_msg_type', payload.meizu.notice_msg_type ?? 0)
            form.setValue('payload.meizu.notice_bar_type', payload.meizu.notice_bar_type ?? 0)
            form.setValue('payload.meizu.notice_expand_type', payload.meizu.notice_expand_type ?? 0)
            form.setValue('payload.meizu.notice_expand_content', payload.meizu.notice_expand_content || '')
            form.setValue('payload.meizu.notice_expand_img_url', payload.meizu.notice_expand_img_url || '')
            form.setValue('payload.meizu.click_type', payload.meizu.click_type ?? 0)
            form.setValue('payload.meizu.activity', payload.meizu.activity || '')
            form.setValue('payload.meizu.url', payload.meizu.url || '')
            form.setValue('payload.meizu.parameters', payload.meizu.parameters || {})
            form.setValue('payload.meizu.custom_attribute', payload.meizu.custom_attribute || '')
            form.setValue('payload.meizu.off_line', payload.meizu.off_line ?? 1)
            form.setValue('payload.meizu.valid_time', payload.meizu.valid_time ?? 24)
            form.setValue('payload.meizu.suspend', payload.meizu.suspend ?? 0)
            form.setValue('payload.meizu.clear_notice_bar', payload.meizu.clear_notice_bar ?? 1)
            form.setValue('payload.meizu.notify_key', payload.meizu.notify_key || '')
            form.setValue('payload.meizu.vibrate', payload.meizu.vibrate ?? 1)
            form.setValue('payload.meizu.lights', payload.meizu.lights ?? 1)
            form.setValue('payload.meizu.sound', payload.meizu.sound ?? 1)
            form.setValue('payload.meizu.subtitle', payload.meizu.subtitle || '')
            form.setValue('payload.meizu.pull_down_top', payload.meizu.pull_down_top ?? 0)
            form.setValue('payload.meizu.time_top', payload.meizu.time_top ?? 3600)
            form.setValue('payload.meizu.not_group', payload.meizu.not_group ?? 0)
            form.setValue('payload.meizu.title_color', payload.meizu.title_color || '')
            form.setValue('payload.meizu.background_img_url', payload.meizu.background_img_url || '')
            form.setValue('payload.meizu.small_icon_url', payload.meizu.small_icon_url || '')
            form.setValue('payload.meizu.big_icon_url', payload.meizu.big_icon_url || '')
            form.setValue('payload.meizu.callback', payload.meizu.callback || '')
            form.setValue('payload.meizu.callback_param', payload.meizu.callback_param || '')
            form.setValue('payload.meizu.callback_type', payload.meizu.callback_type || '3')
          }

          // 处理荣耀特有参数
          if (payload.honor) {
            form.setValue('payload.honor.importance', payload.honor.importance || 'NORMAL')
            form.setValue('payload.honor.ttl', payload.honor.ttl || '86400s')
            form.setValue('payload.honor.target_user_type', payload.honor.target_user_type || 0)
          }
        }
        
        // 设置为单设备推送
        form.setValue('target_type', 'single')
        setActiveTab('single')
        
        // 设置设备Token
        if (reuseData.device_token) {
          form.setValue('device_ids', reuseData.device_token)
        }
        
        toast.success('已复用推送内容，请检查并修改后发送')
      } catch (error) {
        console.error('解析复用数据失败:', error)
        toast.error('复用数据格式错误')
      }
    }
  }, [location.search, form])

  const onSubmit = async (data: PushFormData) => {
    if (!requireApp(currentApp)) {
      return
    }

    try {
      setSending(true)
      const payloadToSend = data.payload ? { ...data.payload } : undefined
      const pushEnvironment = data.platform === 'android' ? undefined : data.push_environment
      if (payloadToSend?.vivo && !payloadToSend.vivo.category) {
        delete payloadToSend.vivo
      }
      
      // 如果设置了定时发送时间，创建定时推送任务
      if (data.schedule_time) {
        // 转换payload格式
        let payloadString = ''
        if (payloadToSend && (payloadToSend.action || payloadToSend.url || payloadToSend.data || payloadToSend.huawei || payloadToSend.xiaomi || payloadToSend.oppo || payloadToSend.vivo)) {
          payloadString = JSON.stringify(payloadToSend)
        }
        
        // 根据推送类型生成target_config
        let targetConfig = ''
        switch (data.target_type) {
          case 'single':
            if (!data.device_ids) {
              toast.error('请输入设备Token')
              return
            }
            targetConfig = JSON.stringify([data.device_ids])
            break
            
          case 'batch': {
            if (!data.device_ids) {
              toast.error('请输入设备Token列表')
              return
            }
            const deviceIds = data.device_ids.split(',').map(id => id.trim()).filter(Boolean)
            if (deviceIds.length === 0) {
              toast.error('请输入有效的设备Token列表')
              return
            }
            targetConfig = JSON.stringify(deviceIds)
            break
          }

          case 'tags': {
            if (!data.tags || data.tags.length === 0) {
              toast.error('请至少添加一个标签筛选条件')
              return
            }
            targetConfig = JSON.stringify(data.tags)
            break
          }
            
          case 'broadcast': {
            const broadcastConfig: Record<string, string> = {}
            if (data.platform) {
              broadcastConfig.platform = data.platform
            }
            if (data.vendor) {
              broadcastConfig.vendor = data.vendor
            }
            if (pushEnvironment) {
              broadcastConfig.push_environment = pushEnvironment
            }
            targetConfig = JSON.stringify(broadcastConfig)
            break
          }
        }
        
        // 创建定时推送
        await ScheduledPushService.createScheduledPush(currentApp.id, {
          title: data.title,
          content: data.content,
          payload: payloadString,
          scheduled_at: data.schedule_time,
          repeat_type: 'none',
          timezone: 'Asia/Shanghai',
          push_type: data.target_type,
          target_config: targetConfig,
        })
        
        toast.success('定时推送创建成功')
      } else {
        // 立即发送推送
        switch (data.target_type) {
          case 'single':
            if (!data.device_ids) {
              toast.error('请输入设备Token')
              return
            }
            await PushService.sendSingle(currentApp.id, {
              device_id: data.device_ids,
              title: data.title,
              content: data.content,
              badge: data.badge,
              payload: payloadToSend,
            })
            break
            
          case 'batch': {
            if (!data.device_ids) {
              toast.error('请输入设备Token列表')
              return
            }
            const deviceIds = data.device_ids.split(',').map(id => id.trim()).filter(Boolean)
            if (deviceIds.length === 0) {
              toast.error('请输入有效的设备Token列表')
              return
            }
            await PushService.sendBatch(currentApp.id, {
              device_ids: deviceIds,
              title: data.title,
              content: data.content,
              badge: data.badge,
              payload: payloadToSend,
            })
            break
          }

          case 'tags': {
            if (!data.tags || data.tags.length === 0) {
              toast.error('请至少添加一个标签筛选条件')
              return
            }
            await PushService.sendByTags(currentApp.id, {
              title: data.title,
              content: data.content,
              badge: data.badge,
              payload: payloadToSend,
              target: {
                type: 'tags',
                tags: data.tags,
                platform: data.platform || undefined,
                channel: data.vendor || undefined,
                push_environment: pushEnvironment,
              }
            })
            break
          }
            
          case 'broadcast':
            await PushService.sendBroadcast(currentApp.id, {
              title: data.title,
              content: data.content,
              badge: data.badge,
              payload: payloadToSend,
              platform: data.platform || undefined,
              vendor: data.vendor || undefined,
              push_environment: pushEnvironment,
            })
            break
            
          case 'groups':
            if (!data.group_ids || data.group_ids.length === 0) {
              throw new Error('请选择至少一个设备分组')
            }
            await PushService.sendPush(currentApp.id, {
              title: data.title,
              content: data.content,
              badge: data.badge,
              payload: payloadToSend,
              target: {
                type: 'groups',
                group_ids: data.group_ids,
                platform: data.platform || undefined,
                channel: data.vendor || undefined,
                push_environment: pushEnvironment,
              },
              schedule_time: data.schedule_time,
            })
            break
        }
        
        toast.success('推送发送成功')
      }
      
      form.reset()
    } catch (error: unknown) {
      toast.error((error as Error).message || '推送发送失败')
    } finally {
      setSending(false)
    }
  }

  const pushTypes = [
    {
      id: 'single',
      title: '单设备推送',
      description: '向指定的单个设备发送推送',
      icon: <Smartphone className="h-5 w-5" />,
    },
    {
      id: 'batch',
      title: '批量推送',
      description: '向多个指定设备发送推送',
      icon: <UserCheck className="h-5 w-5" />,
    },
    {
      id: 'groups',
      title: '分组推送',
      description: '向指定的设备分组发送推送',
      icon: <UserCheck className="h-5 w-5" />,
    },
    {
      id: 'tags',
      title: '标签推送',
      description: '向具有指定标签的设备发送推送',
      icon: <Tag className="h-5 w-5" />,
    },
    {
      id: 'broadcast',
      title: '广播推送',
      description: '向所有设备或指定平台发送推送',
      icon: <Send className="h-5 w-5" />,
    },
  ]

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
          icon={<Send className="h-16 w-16 text-muted-foreground" />}
          description={APP_SELECTION_DESCRIPTIONS.pushSend}
        />
      ) : (
        <Main>
            <div className='mb-6 flex flex-col gap-1'>
              <h1 className='text-2xl font-bold tracking-tight'>发送推送</h1>
              <p className='text-muted-foreground'>
                向应用 "{currentApp.name}" 的设备发送推送通知
              </p>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
              {/* 推送类型选择 */}
              <div className='lg:col-span-1'>
                <h3 className='text-lg font-medium mb-4'>推送类型</h3>
                <div className='space-y-3'>
                  {pushTypes.map((type) => (
                    <Card 
                      key={type.id}
                      className={`cursor-pointer transition-colors ${
                        activeTab === type.id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        setActiveTab(type.id)
                        form.setValue('target_type', type.id as PushFormData['target_type'])
                      }}
                    >
                      <CardContent className='px-4 py-1'>
                        <div className='flex items-start gap-3'>
                          <div className={`p-2 rounded-lg ${
                            activeTab === type.id 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}>
                            {type.icon}
                          </div>
                          <div className='flex-1'>
                            <h4 className='font-medium'>{type.title}</h4>
                            <p className='text-sm text-muted-foreground mt-1'>
                              {type.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* 推送表单 */}
              <div className='lg:col-span-2'>
                <h3 className='text-lg font-medium mb-4'>推送消息内容</h3>
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Send className="h-5 w-5" />
                      推送消息内容
                    </CardTitle>
                    <CardDescription>
                      填写推送消息的标题、内容和目标设备
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {/* 消息内容 */}
                        <div className='space-y-4'>
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
                              platform={form.watch('platform') || 'all'}
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
                                  <Input 
                                    placeholder="输入推送标题" 
                                    maxLength={200}
                                    {...field} 
                                  />
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
                                    placeholder="输入推送消息内容"
                                    className="resize-none"
                                    rows={4}
                                    maxLength={1000}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

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
                                <Tabs defaultValue='huawei' className='gap-y-6'>
                                  <TabsList className='flex flex-wrap gap-2'>
                                    <TabsTrigger value='huawei'>
                                      <span className='text-orange-600'>📱</span> 华为
                                    </TabsTrigger>
                                    <TabsTrigger value='honor'>
                                      <span className='text-purple-600'>📱</span> 荣耀
                                    </TabsTrigger>
                                    <TabsTrigger value='xiaomi'>
                                      <span className='text-blue-600'>📱</span> 小米
                                    </TabsTrigger>
                                    <TabsTrigger value='oppo'>
                                      <span className='text-green-600'>📱</span> OPPO
                                    </TabsTrigger>
                                    <TabsTrigger value='vivo'>
                                      <span className='text-blue-600'>📱</span> VIVO
                                    </TabsTrigger>
                                    <TabsTrigger value='meizu'>
                                      <span className='text-blue-400'>📱</span> 魅族
                                    </TabsTrigger>
                                  </TabsList>

                                  <TabsContent value='huawei'>
                                    <div className='space-y-4'>
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
                                  </TabsContent>

                                  <TabsContent value='honor'>
                                    <div className='space-y-4'>
                                      <div className='grid items-start grid-cols-1 md:grid-cols-2 gap-4'>
                                        <FormField
                                          control={form.control}
                                          name="payload.honor.importance"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel className='flex items-center gap-1'>
                                                消息重要性 (importance)
                                                <Tooltip>
                                                  <TooltipTrigger>
                                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent side="top">
                                                    <div className='space-y-1 text-sm'>
                                                      <p><strong>NORMAL</strong>: 服务通讯类消息，正常优先级（推荐）</p>
                                                      <p><strong>HIGH</strong>: 紧急消息，高优先级</p>
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
                                                  <SelectItem value="HIGH">HIGH</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </FormItem>
                                          )}
                                        />

                                        <FormField
                                          control={form.control}
                                          name="payload.honor.target_user_type"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel className='flex items-center gap-1'>
                                                目标用户类型 (target_user_type)
                                                <Tooltip>
                                                  <TooltipTrigger>
                                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent side="top">
                                                    <div className='space-y-1 text-sm'>
                                                      <p><strong>0</strong>: 正式消息（推荐）</p>
                                                      <p><strong>1</strong>: 测试消息</p>
                                                    </div>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </FormLabel>
                                              <Select value={field.value?.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                                                <FormControl>
                                                  <SelectTrigger>
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                  <SelectItem value="0">正式消息</SelectItem>
                                                  <SelectItem value="1">测试消息</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                    </div>
                                  </TabsContent>

                                  <TabsContent value='xiaomi'>
                                    <div className='space-y-4'>
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
                                                <Input                                                   placeholder="例如：private_msg_channel"
                                                  {...field}                                                 />
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
                                  </TabsContent>

                                  <TabsContent value='oppo'>
                                    <div className='space-y-4'>
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
                                                      <p>• <strong>SUBSCRIPTION</strong>: 个人订阅</p>
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
                                                <Input placeholder="例如：high_priority_channel" {...field} />
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                    </div>
                                  </TabsContent>

                                  <TabsContent value='vivo'>
                                    <div className='space-y-4'>
                                      <FormField
                                        control={form.control}
                                        name="payload.vivo.category"
                                        render={({ field }) => (
                                          <FormItem className='md:max-w-md'>
                                            <FormLabel className='flex items-center gap-1'>
                                              消息分类 (category)
                                              <Tooltip>
                                                <TooltipTrigger>
                                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                  <div className='space-y-1 text-sm max-w-sm'>
                                                    <p>按照 vivo 官方分类说明选择最贴近场景的类别。</p>
                                                    <p>category 为必填参数，用于区分系统消息与运营消息细分场景。</p>
                                                    <p className='text-blue-600'>详情参考《推送消息分类说明》。</p>
                                                  </div>
                                                </TooltipContent>
                                              </Tooltip>
                                            </FormLabel>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue placeholder="选择消息分类" />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                {ANDROID_MESSAGE_CATEGORY_GROUPS.map((group) => (
                                                  <SelectGroup key={group.label}>
                                                    <SelectLabel className='text-xs text-muted-foreground'>{group.label}</SelectLabel>
                                                    {group.options.map((option) => (
                                                      <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectGroup>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                  </TabsContent>

                                  <TabsContent value='meizu'>
                                    <div className='grid items-start grid-cols-1 md:grid-cols-2 gap-4'>
                                      <FormField
                                        control={form.control}
                                        name="payload.meizu.notice_msg_type"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className='flex items-center gap-1'>
                                              消息分类
                                              <Tooltip>
                                                <TooltipTrigger>
                                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                  <div className='space-y-1 text-sm'>
                                                    <p>0=公信消息（默认）</p>
                                                    <p>1=私信消息</p>
                                                  </div>
                                                </TooltipContent>
                                              </Tooltip>
                                            </FormLabel>
                                            <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                <SelectItem value="0">公信消息</SelectItem>
                                                <SelectItem value="1">私信消息</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </FormItem>
                                        )}
                                      />

                                      <FormField
                                        control={form.control}
                                        name="payload.meizu.notice_bar_type"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className='flex items-center gap-1'>
                                              通知栏样式
                                              <Tooltip>
                                                <TooltipTrigger>
                                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                  <div className='space-y-1 text-sm'>
                                                    <p>0=标准样式（默认）</p>
                                                    <p>2=原生样式</p>
                                                  </div>
                                                </TooltipContent>
                                              </Tooltip>
                                            </FormLabel>
                                            <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                <SelectItem value="0">标准样式</SelectItem>
                                                <SelectItem value="2">原生样式</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                  </TabsContent>
                                </Tabs>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>

                        {/* 目标设备配置 */}

                        <div className='space-y-4'>
                          <h4 className='font-medium'>目标设备</h4>
                          
                          {activeTab === 'single' && (
                            <FormField
                              control={form.control}
                              name="device_ids"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>设备Token *</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="输入单个设备Token"
                                      {...field} 
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    输入要推送的设备Token
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {activeTab === 'batch' && (
                            <FormField
                              control={form.control}
                              name="device_ids"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>设备Token列表 *</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="token1, token2, token3"
                                      className="resize-none"
                                      rows={3}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    输入多个设备Token，用逗号分隔，最多1000个
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {activeTab === 'tags' && (
                            <div className='space-y-4'>
                              <TagSelector
                                appId={currentApp.id}
                                value={form.watch('tags') || []}
                                onChange={(tags) => form.setValue('tags', tags)}
                              />
                              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                                <FormField
                                  control={form.control}
                                  name="platform"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>指定平台 (可选)</FormLabel>
                                      <Select onValueChange={(value) => field.onChange(value === 'all' ? '' : value)} value={field.value || 'all'}>
                                        <FormControl>
                                          <SelectTrigger className="w-full">
                                            <SelectValue placeholder="选择平台" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="all">全部平台</SelectItem>
                                          <SelectItem value="ios">仅 iOS</SelectItem>
                                          <SelectItem value="android">仅 Android</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="vendor"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>指定厂商 (可选)</FormLabel>
                                      <Select onValueChange={(value) => field.onChange(value === 'all' ? '' : value)} value={field.value || 'all'}>
                                        <FormControl>
                                          <SelectTrigger className="w-full">
                                            <SelectValue placeholder="选择厂商" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {ANDROID_VENDOR_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="push_environment"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>APNs环境 (可选)</FormLabel>
                                      <Select onValueChange={(value) => field.onChange(value === 'all' ? undefined : value)} value={field.value || 'all'}>
                                        <FormControl>
                                          <SelectTrigger className="w-full">
                                            <SelectValue placeholder="选择环境" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="all">全部环境</SelectItem>
                                          <SelectItem value="development">开发</SelectItem>
                                          <SelectItem value="production">生产</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          )}

                          {activeTab === 'broadcast' && (
                            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                              <FormField
                                control={form.control}
                                name="platform"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>指定平台 (可选)</FormLabel>
                                    <Select onValueChange={(value) => field.onChange(value === 'all' ? '' : value)} value={field.value || 'all'}>
                                      <FormControl>
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="选择平台" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="all">全部平台</SelectItem>
                                        <SelectItem value="ios">仅 iOS</SelectItem>
                                        <SelectItem value="android">仅 Android</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="vendor"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>指定厂商 (可选)</FormLabel>
                                    <Select onValueChange={(value) => field.onChange(value === 'all' ? '' : value)} value={field.value || 'all'}>
                                      <FormControl>
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="选择厂商" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {ANDROID_VENDOR_OPTIONS.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="push_environment"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>APNs环境 (可选)</FormLabel>
                                    <Select onValueChange={(value) => field.onChange(value === 'all' ? undefined : value)} value={field.value || 'all'}>
                                      <FormControl>
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="选择环境" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="all">全部环境</SelectItem>
                                        <SelectItem value="development">开发</SelectItem>
                                        <SelectItem value="production">生产</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}

                          {activeTab === 'groups' && (
                            <div className='space-y-4'>
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
                                        appId={currentApp.id}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      选择要推送的设备分组，支持多选
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                                <FormField
                                  control={form.control}
                                  name="platform"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>指定平台 (可选)</FormLabel>
                                      <Select onValueChange={(value) => field.onChange(value === 'all' ? '' : value)} value={field.value || 'all'}>
                                        <FormControl>
                                          <SelectTrigger className="w-full">
                                            <SelectValue placeholder="选择平台" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="all">全部平台</SelectItem>
                                          <SelectItem value="ios">仅 iOS</SelectItem>
                                          <SelectItem value="android">仅 Android</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="vendor"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>指定厂商 (可选)</FormLabel>
                                      <Select onValueChange={(value) => field.onChange(value === 'all' ? '' : value)} value={field.value || 'all'}>
                                        <FormControl>
                                          <SelectTrigger className="w-full">
                                            <SelectValue placeholder="选择厂商" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {ANDROID_VENDOR_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="push_environment"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>APNs环境 (可选)</FormLabel>
                                      <Select onValueChange={(value) => field.onChange(value === 'all' ? undefined : value)} value={field.value || 'all'}>
                                        <FormControl>
                                          <SelectTrigger className="w-full">
                                            <SelectValue placeholder="选择环境" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="all">全部环境</SelectItem>
                                          <SelectItem value="development">开发</SelectItem>
                                          <SelectItem value="production">生产</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 定时发送 (可选) */}
                        <div className='space-y-4'>
                          <h4 className='font-medium flex items-center gap-2'>
                            <Clock className="h-4 w-4" />
                            定时发送 (可选)
                          </h4>
                          <FormField
                            control={form.control}
                            name="schedule_time"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>发送时间</FormLabel>
                                <FormControl>
                                  <DateTimePicker
                                    value={field.value ? new Date(field.value) : undefined}
                                    onChange={(date: Date | undefined) => field.onChange(date ? date.toISOString() : '')}
                                    placeholder="选择发送时间"
                                  />
                                </FormControl>
                                <FormDescription>
                                  留空则立即发送，否则在指定时间发送
                                </FormDescription>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* 发送按钮 */}
                        <div className='flex justify-end pt-4'>
                          <Button type="submit" disabled={sending} className="min-w-32">
                            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Send className="mr-2 h-4 w-4" />
                            {form.watch('schedule_time') ? '定时发送' : '立即发送'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </div>
        </Main>
      )}
    </>
  )
}
