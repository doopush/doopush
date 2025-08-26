import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, CloudUpload, X } from 'lucide-react'
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
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from '@/components/ui/file-upload'
import { AppService } from '@/services/app-service'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

// 表单验证规则
const createAppSchema = z.object({
  name: z.string().min(1, '应用名称不能为空').max(100, '应用名称不能超过100个字符'),
  package_name: z
    .string()
    .min(1, '包名不能为空')
    .max(255, '包名不能超过255个字符')
    .regex(
      /^[a-zA-Z][a-zA-Z0-9._]*$/,
      '包名格式错误，请使用字母、数字、点和下划线'
    ),
  description: z.string().max(500, '描述不能超过500个字符').optional(),
  platform: z.enum(['ios', 'android', 'both']).refine(val => val, {
    message: '请选择支持的平台',
  }),
  icon_files: z
    .array(z.custom<File>())
    .max(1, '最多只能上传1个图标文件')
    .refine((files) => files.every((file) => file.size <= 5 * 1024 * 1024), {
      message: '文件大小必须小于5MB',
      path: ['icon_files'],
    })
    .optional(),
})

type CreateAppFormData = z.infer<typeof createAppSchema>

interface CreateAppDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateAppDialog({ open, onOpenChange, onSuccess }: CreateAppDialogProps) {
  const [loading, setLoading] = useState(false)
  const { setUserApps, setCurrentApp } = useAuthStore()

  const form = useForm<CreateAppFormData>({
    resolver: zodResolver(createAppSchema),
    defaultValues: {
      name: '',
      package_name: '',
      description: '',
      platform: 'both',
      icon_files: [],
    },
  })

  const onSubmit = async (data: CreateAppFormData) => {
    try {
      setLoading(true)
      
      // 处理图标上传
      let appIcon = ''
      if (data.icon_files && data.icon_files.length > 0) {
        try {
          const uploadResult = await AppService.uploadIcon(data.icon_files[0])
          appIcon = uploadResult.url
        } catch (error) {
          toast.error('图标上传失败: ' + ((error as Error).message || ''))
          return
        }
      }
      
      // 创建应用
      const createData = {
        name: data.name,
        package_name: data.package_name,
        description: data.description,
        platform: data.platform,
        app_icon: appIcon,
      }
      
      const newApp = await AppService.createApp(createData)
      
      // 刷新sidebar的应用列表（包括禁用的应用）
      const allApps = await AppService.getApps()
      setUserApps(allApps)
      
      // 自动选择新创建的应用
      setCurrentApp(newApp)
      
      toast.success('应用创建成功')
      form.reset()
      onSuccess()
    } catch (error) {
      toast.error((error as Error).message || '创建应用失败')
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>创建新应用</DialogTitle>
          <DialogDescription>
            创建一个新的推送应用，配置基本信息和支持的平台
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>应用名称 *</FormLabel>
                  <FormControl>
                    <Input placeholder="我的推送应用" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="package_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>包名 *</FormLabel>
                  <FormControl>
                    <Input placeholder="com.example.myapp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>支持平台 *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择支持的平台" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ios">仅 iOS</SelectItem>
                      <SelectItem value="android">仅 Android</SelectItem>
                      <SelectItem value="both">iOS + Android</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>应用描述</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="简要描述应用的功能和用途"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon_files"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>应用图标</FormLabel>
                  <FormControl>
                    <FileUpload
                      value={field.value || []}
                      onValueChange={field.onChange}
                      accept="image/*"
                      maxFiles={1}
                      maxSize={5 * 1024 * 1024}
                      onFileReject={(_, message) => {
                        form.setError('icon_files', {
                          message,
                        })
                      }}
                    >
                      <FileUploadDropzone className="flex-row flex-wrap border-dotted text-center">
                        <CloudUpload className="size-4" />
                        拖拽或
                        <FileUploadTrigger asChild>
                          <Button variant="link" size="sm" className="p-0">
                            选择图标
                          </Button>
                        </FileUploadTrigger>
                        上传应用图标
                      </FileUploadDropzone>
                      <FileUploadList>
                        {(field.value || []).map((file, index) => (
                          <FileUploadItem key={index} value={file}>
                            <FileUploadItemPreview />
                            <FileUploadItemMetadata />
                            <FileUploadItemDelete asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                              >
                                <X />
                                <span className="sr-only">删除</span>
                              </Button>
                            </FileUploadItemDelete>
                          </FileUploadItem>
                        ))}
                      </FileUploadList>
                    </FileUpload>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={loading}
              >
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                创建应用
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
