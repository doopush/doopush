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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuthStore } from '@/stores/auth-store'
import { ConfigService } from '@/services/config-service'
import { Apple } from '@/components/platform-icon'
import { requireApp } from '@/utils/app-utils'
import { toast } from 'sonner'
import type { AppConfig } from '@/types/api'
import { ANDROID_VENDORS, ANDROID_VENDOR_ICONS } from '@/lib/constants'

// 通用编辑配置表单验证
const editConfigSchema = z.object({
  // iOS APNs 字段
  key_id: z.string().optional(),
  team_id: z.string().optional(),
  bundle_id: z.string().optional(),
  private_key: z.string().optional(),
  production: z.boolean().optional(),
  // Android FCM v1 字段
  service_account_key: z.string().optional(), // FCM 服务账号密钥 JSON（包含项目ID）
  // Android 其他厂商字段
  app_id: z.string().optional(),        // 华为/小米/OPPO/VIVO/荣耀
  app_key: z.string().optional(),       // 小米/OPPO/VIVO
  app_secret: z.string().optional(),    // 华为/小米/OPPO/VIVO
  client_id: z.string().optional(),     // 荣耀
  client_secret: z.string().optional(), // 荣耀
  // 通用消息回执字段
  call_back_url: z.string().optional(), // 推送消息回执
})

type EditConfigFormData = z.infer<typeof editConfigSchema>

interface EditConfigDialogProps {
  config: AppConfig
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditConfigDialog({ config, open, onOpenChange, onSuccess }: EditConfigDialogProps) {
  const { currentApp } = useAuthStore()
  const [loading, setLoading] = useState(false)
  // 跟踪哪些字段是隐藏状态
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set())

  const form = useForm<EditConfigFormData>({
    resolver: zodResolver(editConfigSchema),
    defaultValues: {
      key_id: '',
      team_id: '',
      bundle_id: '',
      private_key: '',
      production: false,
      service_account_key: '',
      app_id: '',
      app_key: '',
      app_secret: '',
      client_id: '',
      client_secret: '',
      call_back_url: '',
    },
  })

  // 当配置数据变化时解析并填充表单
  useEffect(() => {
    if (config && open) {
      try {
        const configData = JSON.parse(config.config)
        const newHiddenFields = new Set<string>()
        
        // 重置所有字段
        form.reset({
          key_id: '',
          team_id: '',
          bundle_id: '',
          private_key: '',
          production: false,
          service_account_key: '',
          app_id: '',
          app_key: '',
          app_secret: '',
          client_id: '',
          client_secret: '',
          call_back_url: '',
        })
        
        // 检查隐藏字段的函数
        const checkAndSetField = (fieldName: string, value: unknown) => {
          if (typeof value === 'string' && value === '[REDACTED]') {
            newHiddenFields.add(fieldName)
            form.setValue(fieldName as keyof EditConfigFormData, '' as never)
          } else {
            form.setValue(fieldName as keyof EditConfigFormData, (value || '') as never)
          }
        }
        
        // 根据平台和通道填充对应的字段
        if (config.platform === 'ios') {
          checkAndSetField('key_id', configData.key_id)
          checkAndSetField('team_id', configData.team_id)
          checkAndSetField('bundle_id', configData.bundle_id)
          checkAndSetField('private_key', configData.private_key)
          form.setValue('production', configData.production || false)
        } else if (config.platform === 'android') {
          switch (config.channel) {
            case 'fcm':
              checkAndSetField('service_account_key', configData.service_account_key)
              break
            case 'huawei':
              checkAndSetField('app_id', configData.app_id)
              checkAndSetField('app_secret', configData.app_secret)
              break
            case 'xiaomi':
              checkAndSetField('app_id', configData.app_id)
              checkAndSetField('app_key', configData.app_key)
              checkAndSetField('app_secret', configData.app_secret)
              break
            case 'oppo':
              checkAndSetField('app_id', configData.app_id)
              checkAndSetField('app_key', configData.app_key)
              checkAndSetField('app_secret', configData.app_secret)
              break
            case 'vivo':
              checkAndSetField('app_id', configData.app_id)
              checkAndSetField('app_key', configData.app_key)
              checkAndSetField('app_secret', configData.app_secret)
              break
            case 'meizu':
              checkAndSetField('app_id', configData.app_id)
              checkAndSetField('app_secret', configData.app_secret)
              break
          case 'honor':
            checkAndSetField('app_id', configData.app_id)
            checkAndSetField('client_id', configData.client_id)
            checkAndSetField('client_secret', configData.client_secret)
            break
          }
          checkAndSetField('call_back_url', configData.call_back_url)
        }
        
        setHiddenFields(newHiddenFields)
      } catch (error) {
        console.error('解析配置数据失败:', error)
        toast.error('配置数据格式错误')
      }
    }
  }, [config, form, open])

  const onSubmit = async (data: EditConfigFormData) => {
    if (!requireApp(currentApp)) {
      return
    }

    try {
      setLoading(true)
      
      // 根据平台和通道构建配置字段，对于隐藏的字段使用特殊处理
      const buildFieldValue = (fieldName: string, newValue: string | boolean) => {
        // 如果字段被隐藏且用户没有输入新值，发送隐藏标记让后端保持原值
        if (hiddenFields.has(fieldName) && (!newValue || newValue === '')) {
          return '[REDACTED]'
        }
        return newValue
      }
      
      let configData: Record<string, unknown> = {}
      
      if (config.platform === 'ios' && config.channel === 'apns') {
        configData = {
          key_id: buildFieldValue('key_id', data.key_id || ''),
          team_id: buildFieldValue('team_id', data.team_id || ''),
          bundle_id: buildFieldValue('bundle_id', data.bundle_id || ''),
          private_key: buildFieldValue('private_key', data.private_key || ''),
          production: data.production || false
        }
      } else if (config.platform === 'android') {
        switch (config.channel) {
          case 'fcm':
            configData = {
              service_account_key: buildFieldValue('service_account_key', data.service_account_key || '')
            }
            break
          case 'huawei':
            configData = {
              app_id: buildFieldValue('app_id', data.app_id || ''),
              app_secret: buildFieldValue('app_secret', data.app_secret || '')
            }
            break
          case 'xiaomi':
            configData = {
              app_id: buildFieldValue('app_id', data.app_id || ''),
              app_key: buildFieldValue('app_key', data.app_key || ''),
              app_secret: buildFieldValue('app_secret', data.app_secret || '')
            }
            break
          case 'oppo':
            configData = {
              app_id: buildFieldValue('app_id', data.app_id || ''),
              app_key: buildFieldValue('app_key', data.app_key || ''),
              app_secret: buildFieldValue('app_secret', data.app_secret || '')
            }
            break
          case 'vivo':
            configData = {
              app_id: buildFieldValue('app_id', data.app_id || ''),
              app_key: buildFieldValue('app_key', data.app_key || ''),
              app_secret: buildFieldValue('app_secret', data.app_secret || '')
            }
            break
          case 'meizu':
            configData = {
              app_id: buildFieldValue('app_id', data.app_id || ''),
              app_secret: buildFieldValue('app_secret', data.app_secret || '')
            }
            break
          case 'honor':
            configData = {
              app_id: buildFieldValue('app_id', data.app_id || ''),
              client_id: buildFieldValue('client_id', data.client_id || ''),
              client_secret: buildFieldValue('client_secret', data.client_secret || ''),
            }
            break
        }
        configData.call_back_url = buildFieldValue('call_back_url', data.call_back_url || '')
      }
      
      const configJson = JSON.stringify(configData)
      
      await ConfigService.updateConfig(currentApp.id, config.id, {
        config: configJson
      })
      
      toast.success('配置更新成功')
      onSuccess()
    } catch (error) {
      toast.error((error as Error).message || '更新配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
      setTimeout(() => {
        setHiddenFields(new Set())
      }, 300)
    }
  }

  // 获取字段的占位符文本
  const getFieldPlaceholder = (fieldName: string, defaultPlaceholder: string) => {
    if (hiddenFields.has(fieldName)) {
      return '保持现有值不变，或输入新值进行修改'
    }
    return defaultPlaceholder
  }

  // 获取字段的描述文本
  const getFieldDescription = (fieldName: string, defaultDescription: string) => {
    if (hiddenFields.has(fieldName)) {
      return '当前值已隐藏，留空保持不变，或输入新值进行修改'
    }
    return defaultDescription
  }

  const getChannelInfo = (channel: string) => {
    const channelMap: Record<string, { name: string; icon: React.ReactNode }> = {
      apns: { name: 'Apple Push', icon: <Apple className="h-6 w-6" /> },
      fcm: { name: 'Firebase Cloud Messaging', icon: '🔥' },
      ...Object.fromEntries(
        Object.entries(ANDROID_VENDORS).map(([key, vendor]) => [
          key,
          { name: vendor.name, icon: ANDROID_VENDOR_ICONS[key as keyof typeof ANDROID_VENDOR_ICONS] }
        ])
      ),
    }
    return channelMap[channel] || { name: channel, icon: '📱' }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>编辑推送配置</DialogTitle>
          <DialogDescription>
            修改 {getChannelInfo(config.channel).name} 的配置内容
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6">
          {/* 配置信息显示 */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {getChannelInfo(config.channel).icon}
              <div>
                <div className="font-medium">{getChannelInfo(config.channel).name}</div>
                <div className="text-sm text-muted-foreground">
                  {config.platform.toUpperCase()} • 创建于 {new Date(config.created_at).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* iOS APNs 配置字段 */}
              {config.platform === 'ios' && config.channel === 'apns' && (
                <>
                  <FormField
                    control={form.control}
                    name="key_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Key ID *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('key_id', '输入 APNs Key ID')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('key_id', '从Apple Developer中心获取的APNs密钥ID')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="team_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team ID *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('team_id', '输入 Apple Team ID')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('team_id', 'Apple Developer账号的Team ID')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bundle_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bundle ID *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('bundle_id', 'com.example.app')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('bundle_id', '应用的Bundle Identifier')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="private_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Private Key *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={getFieldPlaceholder('private_key', '')}
                            className="resize-none font-mono text-sm"
                            rows={6}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('private_key', '')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                        )}
                      />

                  <FormField
                    control={form.control}
                    name="production"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>生产环境</FormLabel>
                          <FormDescription>
                            勾选表示使用生产环境APNs，否则使用开发环境
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Android FCM 配置字段 */}
              {config.platform === 'android' && config.channel === 'fcm' && (
                <>
                  <FormField
                    control={form.control}
                    name="service_account_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>服务账号密钥 *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={getFieldPlaceholder('service_account_key', '')}
                            className="min-h-[80px] font-mono text-sm"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('service_account_key', '')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="call_back_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>消息回执</FormLabel>
                        <FormControl>
                          <Input placeholder="输入推送消息回执（可选）" {...field} />
                        </FormControl>
                        <FormDescription>
                          推送状态回调地址，用于接收推送结果通知
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Android 华为配置字段 */}
              {config.platform === 'android' && config.channel === 'huawei' && (
                <>
                  <FormField
                    control={form.control}
                    name="app_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App ID *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_id', '输入华为 App ID')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_id', '华为开发者联盟的应用ID')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="app_secret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App Secret *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_secret', '输入华为 App Secret')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_secret', '华为开发者联盟的应用密钥')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                </>
              )}

              {/* Android 小米配置字段 */}
              {config.platform === 'android' && config.channel === 'xiaomi' && (
                <>
                  <FormField
                    control={form.control}
                    name="app_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App ID *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_id', '输入小米 App ID')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_id', '小米开发者平台的应用ID')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="app_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App Key *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_key', '输入小米 App Key')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_key', '小米开发者平台的应用密钥')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="app_secret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App Secret *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_secret', '输入小米 App Secret')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_secret', '小米开发者联盟的应用密钥')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="call_back_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>消息回执</FormLabel>
                        <FormControl>
                          <Input placeholder="输入推送消息回执（可选）" {...field} />
                        </FormControl>
                        <FormDescription>
                          推送状态回调地址，用于接收推送结果通知
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Android OPPO配置字段 */}
              {config.platform === 'android' && config.channel === 'oppo' && (
                <>
                  <FormField
                    control={form.control}
                    name="app_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App ID *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_id', '输入 OPPO App ID')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_id', 'OPPO开发者平台的应用ID')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="app_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App Key *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_key', '输入 OPPO App Key')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_key', 'OPPO开发者平台的应用密钥')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="app_secret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Master Secret *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_secret', '输入 OPPO Master Secret')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_secret', 'OPPO开发者联盟的主密钥')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="call_back_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>消息回执</FormLabel>
                        <FormControl>
                          <Input placeholder="输入推送消息回执（可选）" {...field} />
                        </FormControl>
                        <FormDescription>
                          推送状态回调地址，用于接收推送结果通知
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Android VIVO配置字段 */}
              {config.platform === 'android' && config.channel === 'vivo' && (
                <>
                  <FormField
                    control={form.control}
                    name="app_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App ID *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_id', `输入 ${config.channel.toUpperCase()} App ID`)} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_id', `${config.channel.toUpperCase()}开发者平台的应用ID`)}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="app_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App Key *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_key', `输入 ${config.channel.toUpperCase()} App Key`)} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_key', `${config.channel.toUpperCase()}开发者平台的应用密钥`)}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="app_secret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App Secret *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_secret', `输入 ${config.channel.toUpperCase()} App Secret`)} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_secret', `${config.channel.toUpperCase()}开发者平台的应用密钥`)}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="call_back_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>消息回执id</FormLabel>
                        <FormControl>
                          <Input placeholder="输入推送消息回执id(可选)" {...field} />
                        </FormControl>
                        <FormDescription>
                          推送状态回调地址id, 用于接收推送结果通知
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Android 魅族配置字段 */}
              {config.platform === 'android' && config.channel === 'meizu' && (
                <>
                  <FormField
                    control={form.control}
                    name="app_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App ID *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_id', '输入魅族 App ID')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_id', '魅族开发者平台的应用ID')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="app_secret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App Secret *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_secret', '输入魅族 App Secret')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_secret', '魅族开发者平台的应用密钥')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                </>
              )}

              {/* Android 荣耀配置字段 */}
              {config.platform === 'android' && config.channel === 'honor' && (
                <>
                  <FormField
                    control={form.control}
                    name="app_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App ID *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('app_id', '输入荣耀 App ID')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('app_id', '荣耀开发者平台的应用ID')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client ID *</FormLabel>
                        <FormControl>
                          <Input placeholder={getFieldPlaceholder('client_id', '输入荣耀 Client ID')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {getFieldDescription('client_id', '荣耀推送OAuth2认证的Client ID')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

              <FormField
                control={form.control}
                name="client_secret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Secret *</FormLabel>
                    <FormControl>
                      <Input placeholder={getFieldPlaceholder('client_secret', '输入荣耀 Client Secret')} {...field} />
                    </FormControl>
                    <FormDescription>
                      {getFieldDescription('client_secret', '荣耀推送OAuth2认证的Client Secret')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </>
          )}
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
