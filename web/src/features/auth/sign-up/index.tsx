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
import { SignUpForm } from './components/sign-up-form'

export function SignUp() {
  return (
    <AuthLayout>
      <Card className='gap-4 max-md:p-0 max-md:rounded-none max-md:shadow-none max-md:border-0 max-md:bg-transparent'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            创建账户
          </CardTitle>
          <CardDescription>
            输入您的信息以创建新账户 <br />
            已有账户？{' '}
            <Link
              to='/sign-in'
              className='hover:text-primary underline underline-offset-4'
            >
              立即登录
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
        <CardFooter>
          <p className='text-muted-foreground mx-auto text-center text-sm'>
            创建账户即表示您同意我们的{' '}<Link to='/terms' target='_blank' rel='noopener noreferrer' className='hover:text-primary underline underline-offset-4'>服务条款</Link>{' '}和{' '}<Link to='/privacy' target='_blank' rel='noopener noreferrer' className='hover:text-primary underline underline-offset-4'>隐私政策</Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
