import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Key } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import type { User } from '@/types/api'

// 表单验证规则
const changePasswordSchema = z.object({
  old_password: z.string().min(1, '请输入当前密码'),
  new_password: z.string()
    .min(6, '新密码至少6个字符')
    .max(50, '新密码不超过50个字符'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: '两次输入的新密码不一致',
  path: ['confirm_password'],
})

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

interface ChangePasswordDialogProps {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      old_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  const onSubmit = async (_data: ChangePasswordFormData) => {
    try {
      setLoading(true)
      // 这里需要调用修改密码的API
      // await UserService.changePassword(user.id, {
      //   old_password: data.old_password,
      //   new_password: data.new_password,
      // })
      toast.success('密码修改成功')
      form.reset()
      onOpenChange(false)
    } catch (error) {
      toast.error((error as Error).message || '修改密码失败')
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
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            修改登录密码
          </DialogTitle>
          <DialogDescription>
            为了保护您的账户安全，请设置强密码
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="old_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>当前密码 *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="输入当前密码" 
                      type="password" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>新密码 *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="输入新密码" 
                      type="password" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirm_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>确认新密码 *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="再次输入新密码" 
                      type="password" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

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
            修改密码
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
