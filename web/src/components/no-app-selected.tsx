import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { useRouter } from '@tanstack/react-router'
import { NoAuthUser } from './no-auth-user'
import { useAuthStore } from '@/stores/auth-store'

interface NoAppSelectedProps {
  /**
   * 显示的图标组件
   */
  icon?: React.ReactNode
  /**
   * 主标题文案 - 默认为"请选择应用"
   */
  title?: string
  /**
   * 描述文案 - 说明需要选择应用的原因
   */
  description?: string
  /**
   * 是否显示"管理应用"按钮 - 默认为true
   */
  showManageButton?: boolean
  /**
   * 自定义容器高度 - 已废弃，现在使用Main组件布局
   * @deprecated 不再使用，保留为了向后兼容
   */
  height?: string
}

/**
 * 统一的未选择应用提示组件
 * 用于在全站各个页面显示一致的"请选择应用"空状态
 */
export function NoAppSelected({
  icon = <Package className="h-16 w-16 text-muted-foreground" />,
  title = "请选择应用",
  description = "请先选择一个应用来继续操作",
  showManageButton = true,
  height: _height = "400px" // 保留参数向后兼容，但不使用
}: NoAppSelectedProps) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  const handleManageApps = () => {
    router.navigate({ to: '/apps' })
  }

  if (!isAuthenticated) {
    return <NoAuthUser icon={icon}/>
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
        {showManageButton && (
          <Button onClick={handleManageApps} variant="outline">
            <Package className="mr-2 h-4 w-4" />
            管理应用
          </Button>
        )}
      </div>
    </Main>
  )
}
