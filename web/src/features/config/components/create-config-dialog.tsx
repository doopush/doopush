import { useState, useEffect } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { useAuthStore } from '@/stores/auth-store'
import { ConfigService } from '@/services/config-service'
import { requireApp } from '@/utils/app-utils'
import { toast } from 'sonner'

// 通用配置表单验证
const createConfigSchema = z.object({
  platform: z.enum(['ios', 'android']),
  channel: z.string().min(1, '请选择推送通道'),
  // iOS APNs 字段
  key_id: z.string().optional(),
  team_id: z.string().optional(),
  bundle_id: z.string().optional(),
  private_key: z.string().optional(),
  production: z.boolean().optional(),
  // Android 通用字段
  server_key: z.string().optional(), // FCM
  sender_id: z.string().optional(),   // FCM
  app_id: z.string().optional(),      // 华为/小米/OPPO/VIVO/荣耀/三星
  app_key: z.string().optional(),     // 小米/OPPO/VIVO/荣耀/三星
  app_secret: z.string().optional(),  // 华为/小米/VIVO/荣耀/三星
  master_secret: z.string().optional(), // OPPO
}).refine((data) => {
  // 根据平台和通道验证必填字段
  if (data.platform === 'ios' && data.channel === 'apns') {
    return data.key_id && data.team_id && data.bundle_id && data.private_key
  }
  if (data.platform === 'android') {
    switch (data.channel) {
      case 'fcm':
        return data.server_key && data.sender_id
      case 'huawei':
        return data.app_id && data.app_secret
      case 'xiaomi':
        return data.app_id && data.app_key && data.app_secret
      case 'oppo':
        return data.app_id && data.app_key && data.master_secret
      case 'vivo':
      case 'honor':
      case 'samsung':
        return data.app_id && data.app_key && data.app_secret
    }
  }
  return true
}, {
  message: "请填写完整的配置信息"
})

type CreateConfigFormData = z.infer<typeof createConfigSchema>

interface CreateConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (createdPlatform?: string) => void
  defaultPlatform?: 'ios' | 'android'
}

export function CreateConfigDialog({ open, onOpenChange, onSuccess, defaultPlatform = 'ios' }: CreateConfigDialogProps) {
  const { currentApp } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const form = useForm<CreateConfigFormData>({
    resolver: zodResolver(createConfigSchema),
    defaultValues: {
      platform: defaultPlatform,
      channel: defaultPlatform === 'ios' ? 'apns' : 'fcm',
      key_id: '',
      team_id: '',
      bundle_id: '',
      private_key: '',
      production: false,
      server_key: '',
      sender_id: '',
      app_id: '',
      app_key: '',
      app_secret: '',
      master_secret: '',
    },
  })

  // 当对话框打开时重置表单
  useEffect(() => {
    if (open) {
      // 重置到默认值
      form.reset({
        platform: defaultPlatform,
        channel: defaultPlatform === 'ios' ? 'apns' : 'fcm',
        key_id: '',
        team_id: '',
        bundle_id: '',
        private_key: '',
        production: false,
        server_key: '',
        sender_id: '',
        app_id: '',
        app_key: '',
        app_secret: '',
        master_secret: '',
      })
    }
  }, [open, defaultPlatform, form])

  // 获取当前表单值
  const currentPlatform = form.watch('platform')
  const currentChannel = form.watch('channel')



  const onSubmit = async (data: CreateConfigFormData) => {
    if (!requireApp(currentApp)) {
      return
    }

    try {
      setLoading(true)
      
      // 根据平台和通道过滤相关的配置字段
      let configData: Record<string, unknown> = {}
      
      if (data.platform === 'ios' && data.channel === 'apns') {
        configData = {
          key_id: data.key_id,
          team_id: data.team_id,
          bundle_id: data.bundle_id,
          private_key: data.private_key,
          production: data.production || false
        }
      } else if (data.platform === 'android') {
        switch (data.channel) {
          case 'fcm':
            configData = {
              server_key: data.server_key,
              sender_id: data.sender_id
            }
            break
          case 'huawei':
            configData = {
              app_id: data.app_id,
              app_secret: data.app_secret
            }
            break
          case 'xiaomi':
            configData = {
              app_id: data.app_id,
              app_key: data.app_key,
              app_secret: data.app_secret
            }
            break
          case 'oppo':
            configData = {
              app_id: data.app_id,
              app_key: data.app_key,
              master_secret: data.master_secret
            }
            break
          case 'vivo':
          case 'honor':
          case 'samsung':
            configData = {
              app_id: data.app_id,
              app_key: data.app_key,
              app_secret: data.app_secret
            }
            break
        }
      }
      
      const configJson = JSON.stringify(configData)
      
      await ConfigService.setConfig(currentApp.id, {
        platform: data.platform,
        channel: data.channel,
        config: configJson
      })
      
      toast.success('推送配置创建成功')
      form.reset()
      onSuccess(data.platform)
    } catch (error) {
      toast.error((error as Error).message || '创建推送配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
      setTimeout(() => {
        form.reset()
      }, 300)
    }
  }

  // 根据平台提供可用通道
  const getChannelOptions = (platform: string) => {
    if (platform === 'ios') {
      return [
        { value: 'apns', label: 'Apple Push Notification Service (APNs)' },
      ]
    } else {
      return [
        { value: 'fcm', label: 'Firebase Cloud Messaging (FCM)' },
        { value: 'huawei', label: '华为推送 (HMS Push)' },
        { value: 'xiaomi', label: '小米推送 (Mi Push)' },
        { value: 'oppo', label: 'OPPO推送 (OPPO Push)' },
        { value: 'vivo', label: 'VIVO推送 (VIVO Push)' },
        { value: 'honor', label: '荣耀推送 (Honor Push)' },
        { value: 'samsung', label: '三星推送 (Samsung Push)' },
      ]
    }
  }

  // 当平台变化时
  const handlePlatformChange = (newPlatform: 'ios' | 'android') => {
    const newChannel = newPlatform === 'ios' ? 'apns' : 'fcm'
    // 同时设置通道值
    form.setValue('channel', newChannel)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>添加推送配置</DialogTitle>
          <DialogDescription>
            为应用配置推送服务，支持多平台和多厂商通道
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>平台 *</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value)
                          handlePlatformChange(value as 'ios' | 'android')
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full min-w-0">
                            <SelectValue placeholder="选择平台" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ios">iOS</SelectItem>
                          <SelectItem value="android">Android</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="channel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>推送通道 *</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        key={`${currentPlatform}-channel`}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full min-w-0 [&>span]:!truncate [&>span]:!block">
                            <SelectValue placeholder="选择推送通道" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getChannelOptions(currentPlatform).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 动态配置字段 */}
              {currentPlatform === 'ios' && currentChannel === 'apns' && (
                <>
                  <FormField
                    control={form.control}
                    name="key_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Key ID *</FormLabel>
                        <FormControl>
                          <Input placeholder="输入 APNs Key ID" {...field} />
                        </FormControl>
                        <FormDescription>
                          从Apple Developer中心获取的APNs密钥ID
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
                          <Input placeholder="输入 Apple Team ID" {...field} />
                        </FormControl>
                        <FormDescription>
                          Apple Developer账号的Team ID
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
                          <Input placeholder="com.example.app" {...field} />
                        </FormControl>
                        <FormDescription>
                          应用的Bundle Identifier
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
                            placeholder={`-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----`}
                            className="resize-none font-mono text-sm"
                            rows={6}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          APNs私钥内容，包含BEGIN和END标签
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

              {currentPlatform === 'android' && currentChannel === 'fcm' && (
                <>
                  <FormField
                    control={form.control}
                    name="server_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Server Key *</FormLabel>
                        <FormControl>
                          <Input placeholder="输入 FCM Server Key" {...field} />
                        </FormControl>
                        <FormDescription>
                          从Firebase控制台获取的服务器密钥
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sender_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sender ID *</FormLabel>
                        <FormControl>
                          <Input placeholder="输入 FCM Sender ID" {...field} />
                        </FormControl>
                        <FormDescription>
                          Firebase项目的发送者ID
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {currentPlatform === 'android' && currentChannel === 'huawei' && (
                <>
                  <FormField
                    control={form.control}
                    name="app_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App ID *</FormLabel>
                        <FormControl>
                          <Input placeholder="输入华为 App ID" {...field} />
                        </FormControl>
                        <FormDescription>
                          华为开发者联盟的应用ID
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
                          <Input placeholder="输入华为 App Secret" {...field} />
                        </FormControl>
                        <FormDescription>
                          华为开发者联盟的应用密钥
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {currentPlatform === 'android' && currentChannel === 'xiaomi' && (
                <>
                  <FormField
                    control={form.control}
                    name="app_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App ID *</FormLabel>
                        <FormControl>
                          <Input placeholder="输入小米 App ID" {...field} />
                        </FormControl>
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
                          <Input placeholder="输入小米 App Key" {...field} />
                        </FormControl>
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
                          <Input placeholder="输入小米 App Secret" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {currentPlatform === 'android' && currentChannel === 'oppo' && (
                <>
                  <FormField
                    control={form.control}
                    name="app_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App ID *</FormLabel>
                        <FormControl>
                          <Input placeholder="输入 OPPO App ID" {...field} />
                        </FormControl>
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
                          <Input placeholder="输入 OPPO App Key" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="master_secret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Master Secret *</FormLabel>
                        <FormControl>
                          <Input placeholder="输入 OPPO Master Secret" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {currentPlatform === 'android' && (currentChannel === 'vivo' || currentChannel === 'honor' || currentChannel === 'samsung') && (
                <>
                  <FormField
                    control={form.control}
                    name="app_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App ID *</FormLabel>
                        <FormControl>
                          <Input placeholder={`输入 ${currentChannel.toUpperCase()} App ID`} {...field} />
                        </FormControl>
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
                          <Input placeholder={`输入 ${currentChannel.toUpperCase()} App Key`} {...field} />
                        </FormControl>
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
                          <Input placeholder={`输入 ${currentChannel.toUpperCase()} App Secret`} {...field} />
                        </FormControl>
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
            保存配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
