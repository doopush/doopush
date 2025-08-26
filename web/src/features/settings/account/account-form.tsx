import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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
import { PasswordInput } from '@/components/password-input'
import { AuthService } from '@/services/auth-service'

const changePasswordSchema = z.object({
  old_password: z.string().min(1, '请输入原密码'),
  new_password: z.string().min(6, '新密码至少6个字符'),
  confirm_password: z.string().min(6, '请确认新密码'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: '两次输入的密码不一致',
  path: ['confirm_password'],
})

type ChangePasswordValues = z.infer<typeof changePasswordSchema>

export function AccountForm() {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      old_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  const onSubmit = async (data: ChangePasswordValues) => {
    try {
      setIsLoading(true)
      await AuthService.changePassword({
        old_password: data.old_password,
        new_password: data.new_password,
      })
      
      // 重置表单
      form.reset()
      toast.success('密码修改成功')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '修改失败'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <FormField
          control={form.control}
          name='old_password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>原密码</FormLabel>
              <FormControl>
                <PasswordInput placeholder='请输入原密码' {...field} />
              </FormControl>
              <FormDescription>
                请输入您当前的登录密码
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name='new_password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>新密码</FormLabel>
              <FormControl>
                <PasswordInput placeholder='请输入新密码' {...field} />
              </FormControl>
              <FormDescription>
                新密码至少需要6个字符
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name='confirm_password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>确认新密码</FormLabel>
              <FormControl>
                <PasswordInput placeholder='再次输入新密码' {...field} />
              </FormControl>
              <FormDescription>
                请再次输入新密码进行确认
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type='submit' disabled={isLoading}>
          {isLoading ? '修改中...' : '修改密码'}
        </Button>
      </form>
    </Form>
  )
}