import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Palette, Wrench, UserCog } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { SidebarNav } from '@/features/settings/components/sidebar-nav'
import { NoAuthUser } from '@/components/no-auth-user'
import { useAuthStore } from '@/stores/auth-store'

const sidebarNavItems = [
  {
    title: '个人资料',
    href: '/settings',
    icon: <UserCog size={18} />,
  },
  {
    title: '修改密码',
    href: '/settings/account',
    icon: <Wrench size={18} />,
  },
  {
    title: '外观设置',
    href: '/settings/appearance',
    icon: <Palette size={18} />,
  },
]

function Settings() {
  const { isAuthenticated } = useAuthStore()
  
  return (
    <>
      <Header>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {!isAuthenticated ? (
        <NoAuthUser icon={<UserCog className="h-16 w-16 text-muted-foreground" />} />
      ) : (
      <Main fixed>
        <div className='flex flex-col gap-1'>
          <h1 className='text-2xl font-bold tracking-tight'>
            个人设置
          </h1>
          <p className='text-muted-foreground'>
            管理您的账户设置和邮件偏好。
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <aside className='top-0 lg:sticky lg:w-1/5'>
            <SidebarNav items={sidebarNavItems} />
          </aside>
          <div className='flex w-full overflow-y-hidden p-1'>
            <Outlet />
            </div>
          </div>
        </Main>
      )}
    </>
  )
}

export const Route = createFileRoute('/_authenticated/settings')({
  component: Settings,
})
