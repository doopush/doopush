import { useEffect } from 'react'
import { ChevronsUpDown, Plus, Package } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAuthStore } from '@/stores/auth-store'
import { AppService } from '@/services/app-service'
import { cn } from '@/lib/utils'
import { PlatformIndicatorIcon } from '../platform-icon'
import { getIconURL } from '@/utils/app-utils'

export function AppSwitcher() {
  const { isMobile } = useSidebar()
  const { currentApp, userApps, setCurrentApp, setUserApps, isAuthenticated } = useAuthStore()
  const router = useRouter()

  // 加载所有应用列表（包括禁用的）
  useEffect(() => {
    const loadAllApps = async () => {
      if (isAuthenticated) {
        try {
          const allApps = await AppService.getApps()
          setUserApps(allApps)
        } catch (error) {
          console.error('加载应用列表失败:', error)
        }
      }
    }

    loadAllApps()
  }, [isAuthenticated, setUserApps])

  // 当没有选中应用且应用列表存在时，自动选择第一个启用的应用
  useEffect(() => {
    if (!currentApp && userApps.length > 0) {
      setCurrentApp(userApps.find(app => app.status === 1) || userApps[0])
    }
  }, [currentApp, userApps, setCurrentApp])

  const handleCreateApp = () => {
    // 跳转到应用管理页面
    router.navigate({ to: '/apps' })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden'>
                {currentApp?.app_icon ? (
                  <img 
                    src={getIconURL(currentApp.app_icon)} 
                    alt={currentApp.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className='size-4' />
                )}
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold flex items-center gap-1'>
                  {currentApp ? (
                    <>
                      {currentApp.name}
                      {currentApp.status === 0 && (
                        <span className='text-xs bg-red-100 text-red-800 px-1 rounded'>禁用</span>
                      )}
                    </>
                  ) : '选择应用'}
                </span>
                <span className='truncate text-xs'>
                  {currentApp ? currentApp.package_name : '推送应用管理'}
                </span>
              </div>
              <ChevronsUpDown className='ms-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-muted-foreground text-xs'>
              我的应用
            </DropdownMenuLabel>
            {userApps.map((app) => (
              <DropdownMenuItem
                key={app.id}
                onClick={() => setCurrentApp(app)}
                className={cn(
                  'gap-2 p-2',
                  app.status === 0 && 'opacity-75',
                  currentApp?.id === app.id && 'bg-accent text-accent-foreground'
                )}
              >
                <div className='flex size-8 items-center justify-center rounded-sm border overflow-hidden'>
                  {app.app_icon ? (
                    <img 
                      src={getIconURL(app.app_icon)} 
                      alt={app.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className='size-6 shrink-0' />
                  )}
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='font-medium flex items-center gap-1'>
                    <div className='truncate flex-1 min-w-0'>{app.name}</div>
                  </div>
                  <div className='text-xs text-muted-foreground truncate'>
                    {app.package_name}
                  </div>
                </div>
                <div className="ml-1 flex items-center gap-1.5">
                    {app.status === 0 && (
                      <span className='text-xs bg-red-100 text-red-800 px-1 rounded shrink-0'>禁用</span>
                    )}
                  {PlatformIndicatorIcon(app.platform)}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className='gap-2 p-2' onClick={handleCreateApp}>
              <div className='bg-background flex size-6 items-center justify-center rounded-md border'>
                <Plus className='size-4' />
              </div>
              <div className='text-muted-foreground font-medium'>创建新应用</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
