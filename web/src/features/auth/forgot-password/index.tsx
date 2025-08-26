import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { ForgotPasswordForm } from './components/forgot-password-form'

export function ForgotPassword() {
  return (
    <AuthLayout>
      <Card className='gap-4 max-md:p-0 max-md:rounded-none max-md:shadow-none max-md:border-0 max-md:bg-transparent'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            忘记密码
          </CardTitle>
          <CardDescription>
            请输入您注册的邮箱地址，<br />我们将发送重置密码链接给您。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
        <CardFooter>
          <p className='text-muted-foreground mx-auto text-center text-sm'>
            还没有账户？{' '}
            <Link
              to='/sign-up'
              className='hover:text-primary underline underline-offset-4'
            >
              立即注册
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
