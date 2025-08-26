import { User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { useRouter } from '@tanstack/react-router'

interface NoAuthUserProps {
  /**
   * 显示的图标组件
   */
  icon?: React.ReactNode
  /**
   * 主标题文案 - 默认为"请先登录"
   */
  title?: string
  /**
   * 描述文案 - 说明需要登录的原因
   */
  description?: string
  /**
   * 是否显示"立即登录"按钮 - 默认为true
   */
  showLoginButton?: boolean
}

/**
 * 统一的未登录用户提示组件
 * 用于在需要登录的页面显示一致的"请先登录"空状态
 */
export function NoAuthUser({
  icon = <User className="h-16 w-16 text-muted-foreground" />,
  title = "请先登录",
  description = "请先登录账户来访问此功能",
  showLoginButton = true,
}: NoAuthUserProps) {
  const router = useRouter()

  const handleLogin = () => {
    router.navigate({ to: '/sign-in' })
  }

  return (
    <Main className="flex-1 min-h-0 flex items-center justify-center">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-4">
          {icon}
        </div>
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          {description}
        </p>
        {showLoginButton && (
          <Button onClick={handleLogin} variant="outline">
            <User className="mr-2 h-4 w-4" />
            立即登录
          </Button>
        )}
      </div>
    </Main>
  )
}
