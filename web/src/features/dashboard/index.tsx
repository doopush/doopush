import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

import { useAuthStore } from '@/stores/auth-store'
import { PushService } from '@/services/push-service'
import { Send, Smartphone, CheckCircle, XCircle, LayoutDashboard } from 'lucide-react'
import { NoAppSelected } from '@/components/no-app-selected'
import { APP_SELECTION_DESCRIPTIONS } from '@/utils/app-utils'
import { PushOverview } from './components/push-overview'
import { RecentPushes } from './components/recent-pushes'
import { PushEffectAnalysis } from './components/push-effect-analysis'
import { UserActivityAnalysis } from './components/user-activity-analysis'
import { DeviceAnalysis } from './components/device-analysis'

export function Dashboard() {
  const { currentApp } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    total_pushes: 0,
    success_pushes: 0,
    failed_pushes: 0,
    total_devices: 0,
  })
  const [analytics, setAnalytics] = useState<{
    effectMetrics: {
      successRate: number
      clickRate: number
      openRate: number
      avgDailyPushes: number
    }
    userActivityMetrics: {
      totalDevices: number
      activeDevices: number
      activityRate: number
      avgResponseTime: number
    }
    deviceMetrics: {
      platformDistribution: Array<{
        platform: string
        count: number
        percentage: number
        successRate: number
      }>
      vendorDistribution: Array<{
        vendor: string
        count: number
        successRate: number
      }>
    }
    trends: {
      dailySuccess: Array<{
        date: string
        success: number
        total: number
        rate: number
      }>
      dailyActivity: Array<{
        date: string
        clicks: number
        opens: number
        devices: number
      }>
    }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  // 加载推送统计数据
  useEffect(() => {
    const loadPushStatistics = async () => {
      if (!currentApp) return

      try {
        setLoading(true)
        const data = await PushService.getPushStatistics(currentApp.id)
        setStats(data)
      } catch (_error) {
        // 忽略错误，使用默认值
      } finally {
        setLoading(false)
      }
    }

    if (currentApp) {
      loadPushStatistics()
    }
  }, [currentApp])

  // 加载推送分析数据
  useEffect(() => {
    const loadPushAnalytics = async () => {
      if (!currentApp) return

      try {
        setAnalyticsLoading(true)
        const data = await PushService.getPushAnalytics(currentApp.id)
        setAnalytics(data)
      } catch (_error) {
        // 忽略错误，使用默认值
      } finally {
        setAnalyticsLoading(false)
      }
    }

    if (currentApp) {
      loadPushAnalytics()
    }
  }, [currentApp])

  const successRate = stats.total_pushes > 0 
    ? ((stats.success_pushes / stats.total_pushes) * 100).toFixed(1)
    : '0'

  return (
    <>
      <Header>
      {!currentApp ? (
        <>
          <Search />
          <div className='ms-auto flex items-center gap-4'>
            <ThemeSwitch />
            <ConfigDrawer />
            <ProfileDropdown />
          </div>
        </>
      ) : (
        <>
        <TopNav links={topNav} />
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
        </>
      )}
      </Header>

      {!currentApp ? (
        <NoAppSelected 
          icon={<LayoutDashboard className="h-16 w-16 text-muted-foreground" />}
          description={APP_SELECTION_DESCRIPTIONS.dashboard}
        />
      ) : (
        <Main>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex flex-col gap-1'>
              <h1 className='text-2xl font-bold tracking-tight'>推送控制台</h1>
              <p className='text-muted-foreground'>
                {currentApp.name} ({currentApp.package_name})
              </p>
            </div>
            <div className='flex items-center space-x-2'>
              <Button onClick={() => navigate({ to: '/push/send' })}>
                <Send className="mr-2 h-4 w-4" />
                发送推送
              </Button>
            </div>
          </div>

          <Tabs
            orientation='vertical'
            defaultValue='overview'
            className='space-y-4'
          >
            <div className='w-full overflow-x-auto pb-2'>
              <TabsList>
                <TabsTrigger value='overview'>总览</TabsTrigger>
                <TabsTrigger value='analytics'>分析</TabsTrigger>
                <TabsTrigger value='reports'>报告</TabsTrigger>
                <TabsTrigger value='history'>推送历史</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value='overview' className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                <Card>
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      总推送数
                    </CardTitle>
                    <Send className='text-muted-foreground h-4 w-4' />
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      {loading ? '...' : stats.total_pushes.toLocaleString()}
                    </div>
                    <p className='text-muted-foreground text-xs'>
                      累计推送消息数量
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      成功推送
                    </CardTitle>
                    <CheckCircle className='text-muted-foreground h-4 w-4' />
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold text-green-600'>
                      {loading ? '...' : stats.success_pushes.toLocaleString()}
                    </div>
                    <p className='text-muted-foreground text-xs'>
                      成功率: {successRate}%
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>失败推送</CardTitle>
                    <XCircle className='text-muted-foreground h-4 w-4' />
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold text-red-600'>
                      {loading ? '...' : stats.failed_pushes.toLocaleString()}
                    </div>
                    <p className='text-muted-foreground text-xs'>
                      失败率: {loading ? '0' : ((stats.failed_pushes / (stats.total_pushes || 1)) * 100).toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      活跃设备
                    </CardTitle>
                    <Smartphone className='text-muted-foreground h-4 w-4' />
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      {loading ? '...' : stats.total_devices.toLocaleString()}
                    </div>
                    <p className='text-muted-foreground text-xs'>
                      已注册的设备数量
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
                <Card className='col-span-1 lg:col-span-4'>
                  <CardHeader>
                    <CardTitle>推送趋势</CardTitle>
                    <CardDescription>
                      近30天的推送数据趋势分析
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='ps-2'>
                    <PushOverview />
                  </CardContent>
                </Card>
                
                <Card className='col-span-1 lg:col-span-3'>
                  <CardHeader>
                    <CardTitle>最近推送</CardTitle>
                    <CardDescription>
                      最近发送的推送消息记录
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RecentPushes />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value='analytics' className='space-y-4'>
              <div className='grid gap-4 lg:grid-cols-2'>
                {/* 推送效果分析 */}
                <div className='lg:col-span-1'>
                  <PushEffectAnalysis
                    className='h-full'
                    metrics={analytics?.effectMetrics || {
                      successRate: 0,
                      clickRate: 0,
                      openRate: 0,
                      avgDailyPushes: 0
                    }}
                    loading={analyticsLoading}
                  />
                </div>

                {/* 用户活跃度分析 */}
                <div className='lg:col-span-1'>
                  <UserActivityAnalysis
                    className='h-full'
                    metrics={analytics?.userActivityMetrics || {
                      totalDevices: 0,
                      activeDevices: 0,
                      activityRate: 0,
                      avgResponseTime: 0
                    }}
                    loading={analyticsLoading}
                  />
                </div>

                {/* 设备分析 */}
                <div className='lg:col-span-2'>
                  <DeviceAnalysis
                    metrics={analytics?.deviceMetrics || {
                      platformDistribution: [],
                      vendorDistribution: []
                    }}
                    loading={analyticsLoading}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value='reports' className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle>推送报告</CardTitle>
                  <CardDescription>
                    生成和下载详细的推送数据报告
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Button
                      onClick={() => navigate({ to: '/push/statistics' })}
                      size="lg"
                    >
                      <CheckCircle className="mr-2 h-5 w-5" />
                      查看完整推送报告
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value='history' className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle>推送历史记录</CardTitle>
                  <CardDescription>
                    查看完整的推送历史和详细信息
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Button
                      onClick={() => navigate({ to: '/push/logs' })}
                      size="lg"
                    >
                      <CheckCircle className="mr-2 h-5 w-5" />
                      查看完整推送历史
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Main>
      )}
    </>
  )
}

const topNav = [
  {
    title: '总览',
    href: '/dashboard',
    isActive: true,
    disabled: false,
  },
  {
    title: '推送统计',
    href: '/push/statistics',
    isActive: false,
    disabled: false,
  },
  {
    title: '推送历史',
    href: '/push/logs',
    isActive: false,
    disabled: false,
  },
  {
    title: '发送推送',
    href: '/push/send',
    isActive: false,
    disabled: false,
  },
]
