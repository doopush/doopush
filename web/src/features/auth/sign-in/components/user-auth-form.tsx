import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { AuthService } from '@/services/auth-service'
import { useAuthStore } from '@/stores/auth-store'

const formSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z
    .string()
    .min(1, '请输入密码')
    .min(6, '密码至少6个字符'),
})

export function UserAuthForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { setAuth, setUserApps } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true)
      const response = await AuthService.login(data)
      
      // 先设置认证状态
      setAuth(response.user, response.token)
      
      // 获取用户应用列表 - 手动传递token避免时序问题
      const apps = await AuthService.getUserApps(response.token)
      setUserApps(apps)
      
      toast.success('登录成功')
      
      // 跳转到主页面
      router.navigate({ to: '/' })
    } catch (error) {
      toast.error((error as Error).message || '登录失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>用户名</FormLabel>
              <FormControl>
                <Input placeholder='请输入用户名' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>密码</FormLabel>
              <FormControl>
                <PasswordInput placeholder='请输入密码' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='text-muted-foreground absolute end-0 -top-0.5 text-sm font-medium hover:opacity-75'
              >
                忘记密码?
              </Link>
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? '登录中...' : '登录'}
        </Button>
      </form>
    </Form>
  )
}
