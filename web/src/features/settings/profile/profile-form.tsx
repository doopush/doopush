import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { CloudUpload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
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
import { useAuthStore } from '@/stores/auth-store'
import { AuthService } from '@/services/auth-service'
import { getIconURL } from '@/utils/app-utils'

const profileFormSchema = z.object({
  nickname: z.string().max(50, '昵称最多50个字符').optional(),
  avatar_files: z
    .array(z.custom<File>())
    .max(1, '最多只能上传1个头像文件')
    .refine((files) => files.every((file) => file.size <= 5 * 1024 * 1024), {
      message: '文件大小必须小于5MB',
      path: ['avatar_files'],
    })
    .optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

export function ProfileForm() {
  const [isLoading, setIsLoading] = useState(false)
  const { user, setUser } = useAuthStore()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onChange',
    defaultValues: {
      nickname: '',
      avatar_files: [],
    },
  })

  // 加载用户信息
  useEffect(() => {
    if (user) {
      form.reset({
        nickname: user.nickname || '',
        avatar_files: [], // 重置为空，需要重新上传
      })
    }
  }, [user, form])

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      setIsLoading(true)
      
      // 处理头像上传
      let avatarUrl = user?.avatar || '' // 保持原有头像
      if (data.avatar_files && data.avatar_files.length > 0) {
        try {
          // 如果有原头像，先删除
          if (user?.avatar) {
            try {
              await AuthService.deleteUploadedAvatar(user.avatar)
            } catch (error) {
              console.warn('删除原头像失败:', error)
            }
          }
          
          // 上传新头像
          const uploadResult = await AuthService.uploadAvatar(data.avatar_files[0])
          avatarUrl = uploadResult.url
        } catch (error) {
          toast.error('头像上传失败: ' + ((error as Error).message || ''))
          return
        }
      }
      
      // 更新用户资料
      const updateData = {
        nickname: data.nickname,
        avatar: avatarUrl,
      }
      
      const updatedUser = await AuthService.updateProfile(updateData)
      setUser(updatedUser)
      toast.success('个人资料更新成功')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '更新失败'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <div className='grid grid-cols-2 gap-6'>
          <FormItem>
            <FormLabel>用户名</FormLabel>
            <FormControl>
              <Input value={user.username} disabled />
            </FormControl>
            <FormDescription>
              登录用户名，不可修改
            </FormDescription>
          </FormItem>
          <FormItem>
            <FormLabel>邮箱地址</FormLabel>
            <FormControl>
              <Input value={user.email} disabled />
            </FormControl>
            <FormDescription>
              注册邮箱，不可修改
            </FormDescription>
          </FormItem>
        </div>
        
        <FormField
          control={form.control}
          name='nickname'
          render={({ field }) => (
            <FormItem>
              <FormLabel>显示昵称</FormLabel>
              <FormControl>
                <Input placeholder='请输入显示昵称' {...field} />
              </FormControl>
              <FormDescription>
                这是在系统中显示的昵称，可以随时修改
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name='avatar_files'
          render={({ field }) => (
            <FormItem>
              <FormLabel>头像</FormLabel>
              {user.avatar && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <span>当前头像:</span>
                  <img 
                    src={getIconURL(user.avatar)} 
                    alt="当前头像" 
                    className="w-10 h-10 rounded-full border object-cover"
                  />
                </div>
              )}
              <FormControl>
                <FileUpload
                  value={field.value || []}
                  onValueChange={field.onChange}
                  accept="image/*"
                  maxFiles={1}
                  maxSize={5 * 1024 * 1024}
                  onFileReject={(_, message) => {
                    form.setError('avatar_files', {
                      message,
                    })
                  }}
                >
                  <FileUploadDropzone className="flex-row flex-wrap border-dotted text-center">
                    <CloudUpload className="size-4" />
                    拖拽或
                    <FileUploadTrigger asChild>
                      <Button variant="link" size="sm" className="p-0">
                        选择头像
                      </Button>
                    </FileUploadTrigger>
                    {user.avatar ? '替换头像' : '上传头像'}
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
              <FormDescription>
                支持 JPEG、PNG、GIF、WebP、SVG 格式，最大 5MB
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type='submit' disabled={isLoading}>
          {isLoading ? '更新中...' : '更新资料'}
        </Button>
      </form>
    </Form>
  )
}
