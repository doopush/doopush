import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Link, useSearch } from '@tanstack/react-router'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'


export function SignIn() {
  const search = useSearch({ from: '/(auth)/sign-in' })
  
  useEffect(() => {
    const handle = (search as { handle?: string }).handle
    if (handle === 'logout') {
      useAuthStore.getState().logout()
    }
  }, [search])

  return (
    <AuthLayout>
      <Card className='gap-4 max-md:p-0 max-md:rounded-none max-md:shadow-none max-md:border-0 max-md:bg-transparent'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>登录</CardTitle>
          <CardDescription>
            输入您的用户名和密码以登录您的账户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm />
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
