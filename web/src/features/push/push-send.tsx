import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  Send, 
  Tag,
  Smartphone, 
  Loader2,
  Clock,
  UserCheck
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/components/date-time-picker'


import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

import { useAuthStore } from '@/stores/auth-store'
import { PushService } from '@/services/push-service'
import { ScheduledPushService } from '@/services/scheduled-push-service'
import { NoAppSelected } from '@/components/no-app-selected'
import { TagSelector } from '@/components/tag-selector'
import { requireApp, APP_SELECTION_DESCRIPTIONS } from '@/utils/app-utils'
import { toast } from 'sonner'

// 推送表单验证规则
const pushFormSchema = z.object({
  title: z.string().min(1, '推送标题不能为空').max(200, '标题不能超过200个字符'),
  content: z.string().min(1, '推送内容不能为空').max(1000, '内容不能超过1000个字符'),
  payload: z.object({
    action: z.string().optional(),
    url: z.string().url('请输入有效的URL').optional().or(z.literal('')),
    data: z.string().optional(),
  }).optional(),
  target_type: z.enum(['single', 'batch', 'tags', 'broadcast']).refine(val => val, {
    message: '请选择推送类型',
  }),
  device_ids: z.string().optional(),
  tags: z.array(z.object({
    tag_name: z.string().min(1, '标签名称不能为空'),
    tag_value: z.string().optional(),
  })).optional(),
  platform: z.string().optional(),
  vendor: z.string().optional(),
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
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState('single')

  const form = useForm<PushFormData>({
    resolver: zodResolver(pushFormSchema),
    defaultValues: {
      title: '',
      content: '',
      payload: {
        action: '',
        url: '',
        data: '',
      },
      target_type: 'single',
      device_ids: '',
      tags: [],
      platform: '',
      vendor: '',
      schedule_time: '',
    },
  })

  const onSubmit = async (data: PushFormData) => {
    if (!requireApp(currentApp)) {
      return
    }

    try {
      setSending(true)
      
      // 如果设置了定时发送时间，创建定时推送任务
      if (data.schedule_time) {
        // 转换payload格式
        let payloadString = ''
        if (data.payload && (data.payload.action || data.payload.url || data.payload.data)) {
          payloadString = JSON.stringify(data.payload)
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
              payload: data.payload,
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
              payload: data.payload,
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
              payload: data.payload,
              target: {
                type: 'tags',
                tags: data.tags,
                platform: data.platform || undefined,
                channel: data.vendor || undefined,
              }
            })
            break
          }
            
          case 'broadcast':
            await PushService.sendBroadcast(currentApp.id, {
              title: data.title,
              content: data.content,
              payload: data.payload,
              platform: data.platform || undefined,
              vendor: data.vendor || undefined,
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
                      <CardContent className='p-4'>
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
                          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
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
                            <TagSelector
                              appId={currentApp.id}
                              value={form.watch('tags') || []}
                              onChange={(tags) => form.setValue('tags', tags)}
                            />
                          )}

                          {activeTab === 'broadcast' && (
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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
                                        <SelectItem value="all">全部厂商</SelectItem>
                                        <SelectItem value="huawei">华为</SelectItem>
                                        <SelectItem value="xiaomi">小米</SelectItem>
                                        <SelectItem value="oppo">OPPO</SelectItem>
                                        <SelectItem value="vivo">VIVO</SelectItem>
                                        <SelectItem value="honor">荣耀</SelectItem>
                                        <SelectItem value="samsung">三星</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
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
