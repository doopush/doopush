import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from '@tanstack/react-router'
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

const formSchema = z
  .object({
    username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符'),
    email: z.string().email('请输入有效的邮箱地址'),
    password: z
      .string()
      .min(6, '密码至少6个字符'),
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "密码不匹配",
    path: ['confirmPassword'],
  })

export function SignUpForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const setAuth = useAuthStore((state) => state.setAuth)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true)
      
      // 1. 注册用户
      await AuthService.register({
        username: data.username,
        email: data.email,
        password: data.password,
      })
      
      try {
        // 2. 自动登录
        const loginResponse = await AuthService.login({
          username: data.username,
          password: data.password,
        })
        
        // 3. 保存认证状态
        setAuth(loginResponse.user, loginResponse.token)
        
        toast.success('注册成功')
        
        // 4. 跳转到主页面
        router.navigate({ to: '/' })
      } catch (loginError) {
        // 注册成功但自动登录失败
        console.error('自动登录失败:', loginError)
        toast.success('注册成功')
        
        // 跳转到登录页面
        router.navigate({ to: '/sign-in' })
      }
    } catch (error) {
      // 注册失败
      toast.error((error as Error).message || '注册失败')
    } finally {
      setTimeout(() => {
        setIsLoading(false)
      }, 1000);
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
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>邮箱</FormLabel>
              <FormControl>
                <Input placeholder='请输入邮箱' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>密码</FormLabel>
              <FormControl>
                <PasswordInput placeholder='请输入密码' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>确认密码</FormLabel>
              <FormControl>
                <PasswordInput placeholder='请再次输入密码' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? '注册中...' : '创建账户'}
        </Button>
      </form>
    </Form>
  )
}
