import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Play, Loader2, CheckCircle, XCircle } from 'lucide-react'
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
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuthStore } from '@/stores/auth-store'
import { ConfigService } from '@/services/config-service'
import { Apple } from '@/components/platform-icon'
import { toast } from 'sonner'
import type { AppConfig } from '@/types/api'
import { ANDROID_VENDORS, ANDROID_VENDOR_ICONS } from '@/lib/constants'

// 测试表单验证规则
const testConfigSchema = z.object({
  device_id: z.string().min(1, '请输入设备ID'),
  test_title: z.string().min(1, '请输入测试标题').max(200, '标题不能超过200个字符').optional(),
  test_content: z.string().min(1, '请输入测试内容').max(1000, '内容不能超过1000个字符').optional(),
})

type TestConfigFormData = z.infer<typeof testConfigSchema>

interface TestConfigDialogProps {
  config: AppConfig
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TestConfigDialog({ config, open, onOpenChange }: TestConfigDialogProps) {
  const { currentApp } = useAuthStore()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    platform: string
    channel: string
    test_device: string
    config_id?: number
    test_time: string
  } | null>(null)

  const form = useForm<TestConfigFormData>({
    resolver: zodResolver(testConfigSchema),
    defaultValues: {
      device_id: '',
      test_title: '推送配置测试',
      test_content: '这是一条配置测试消息，用于验证推送通道是否正常工作。',
    },
  })

  const onSubmit = async (data: TestConfigFormData) => {
    if (!currentApp) return

    try {
      setTesting(true)
      const result = await ConfigService.testConfig(currentApp.id, {
        platform: config.platform,
        channel: config.channel,
        device_id: data.device_id,
        test_title: data.test_title,
        test_content: data.test_content,
      })
      
      setTestResult(result)
      
      if (result.success) {
        toast.success('推送测试成功')
      } else {
        toast.error(`推送测试失败: ${result.message}`)
      }
    } catch (error) {
      toast.error((error as Error).message || '推送测试失败')
      setTestResult({
        success: false,
        message: (error as Error).message || '推送测试失败',
        platform: config.platform,
        channel: config.channel,
        test_device: data.device_id,
        test_time: new Date().toISOString(),
      })
    } finally {
      setTesting(false)
    }
  }

  const handleClose = () => {
    if (!testing) {
      setTestResult(null)
      form.reset()
      onOpenChange(false)
    }
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
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            测试推送配置
          </DialogTitle>
          <DialogDescription>
            向指定设备发送测试推送，验证配置是否正常工作
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6 space-y-6">
          {/* 配置信息显示 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">当前配置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {getChannelInfo(config.channel).icon}
                <div>
                  <div className="font-medium">{getChannelInfo(config.channel).name}</div>
                  <div className="text-sm text-muted-foreground">
                    {config.platform.toUpperCase()} • {config.channel}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Badge>
                    {config.platform === 'ios' ? 'iOS' : 'Android'}
                  </Badge>
                  {(() => {
                    if (config.platform !== 'ios') return null
                    
                    let env = '开发环境'
                    let badgeClass = 'bg-yellow-100 text-yellow-800'
                    try {
                      const configObj = JSON.parse(config.config)
                      if (configObj.production) {
                        env = '生产环境'
                        badgeClass = 'bg-green-100 text-green-800'
                      }
                    } catch {
                      // 解析失败，默认开发环境
                    }
                    return (
                      <Badge className={badgeClass}>
                        {env}
                      </Badge>
                    )
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 测试表单 */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="device_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>测试设备ID *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="输入要测试的设备ID"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      输入已注册的设备ID，该设备将收到测试推送
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="test_title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>测试标题</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="test_content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>测试内容</FormLabel>
                    <FormControl>
                      <Textarea 
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={testing} className="w-full">
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                发送测试推送
              </Button>
            </form>
          </Form>

          {/* 测试结果显示 */}
          {testResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  测试结果
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className={testResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  <AlertDescription className={testResult.success ? "text-green-800" : "text-red-800"}>
                    <div className="space-y-2">
                      <div className="font-medium">
                        {testResult.success ? '✅ 测试成功' : '❌ 测试失败'}
                      </div>
                      <div>{testResult.message}</div>
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground whitespace-nowrap">平台:</span>
                    <span className="font-medium truncate">{testResult.platform.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground whitespace-nowrap">通道:</span>
                    <span className="font-medium truncate">{testResult.channel}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground whitespace-nowrap">测试设备:</span>
                    <span className="font-medium truncate">{testResult.test_device}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground whitespace-nowrap">测试时间:</span>
                    <span className="font-medium truncate">
                      {new Date(testResult.test_time).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
