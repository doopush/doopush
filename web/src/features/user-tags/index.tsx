import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { useAuthStore } from '@/stores/auth-store'
import { TagService } from '@/services/tag-service'
import { NoAppSelected } from '@/components/no-app-selected'
import { APP_SELECTION_DESCRIPTIONS } from '@/utils/app-utils'
import type { TagStatistic } from '@/types/api'
import { Tag, Users } from 'lucide-react'

export function UserTags() {
  const [tagStats, setTagStats] = useState<TagStatistic[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { currentApp } = useAuthStore()

  useEffect(() => {
    if (currentApp?.id) {
      loadTagStatistics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp?.id])

  const loadTagStatistics = async () => {
    if (!currentApp?.id) return
    
    try {
      setIsLoading(true)
      const stats = await TagService.getTagStatistics(currentApp.id)
      setTagStats(stats || [])
    } catch (error) {
      console.error('加载标签统计失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!currentApp) {
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

        <NoAppSelected 
          icon={<Tag className="h-16 w-16 text-muted-foreground" />}
          description={APP_SELECTION_DESCRIPTIONS.userTags}
        />
      </>
    )
  }

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

      <Main>
        <div className='space-y-6'>
          <div className='flex flex-col gap-1'>
            <h1 className='text-2xl font-bold tracking-tight'>用户标签管理</h1>
            <p className='text-muted-foreground'>
              管理 "{currentApp.name}" 应用的用户标签，用于精准推送和用户分群
            </p>
          </div>

          {isLoading ? (
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className='pb-3'>
                    <div className='h-4 w-20 animate-pulse rounded bg-muted' />
                    <div className='h-3 w-16 animate-pulse rounded bg-muted' />
                  </CardHeader>
                  <CardContent>
                    <div className='h-8 w-12 animate-pulse rounded bg-muted' />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !tagStats || tagStats.length === 0 ? (
            <Card>
              <CardContent className='flex h-40 items-center justify-center'>
                <div className='text-center text-muted-foreground py-8'>
                  暂无标签数据
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {tagStats?.map((stat, index) => (
                <Card key={index}>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-base font-medium'>
                      {stat.tag_key}
                    </CardTitle>
                    <CardDescription className='flex items-center gap-1'>
                      <Badge variant='outline'>{stat.tag_value}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className='flex items-center gap-2'>
                      <Users className='h-4 w-4 text-muted-foreground' />
                      <span className='text-2xl font-bold'>{stat.user_count}</span>
                      <span className='text-sm text-muted-foreground'>用户</span>
                    </div>
                    <p className='mt-2 text-xs text-muted-foreground'>
                      更新时间: {new Date(stat.updated_at).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>标签管理说明</CardTitle>
              <CardDescription>
                用户标签用于对设备用户进行分类和精准推送
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='rounded-lg bg-muted p-4'>
                <h4 className='font-medium mb-2'>如何使用用户标签：</h4>
                <ul className='space-y-1 text-sm text-muted-foreground'>
                  <li>• 设备在注册时可以附带用户标签信息</li>
                  <li>• 标签以 key-value 形式存储，如：vip_level=gold</li>
                  <li>• 推送时可以基于标签进行精准投放</li>
                  <li>• 系统会自动统计每个标签的用户数量</li>
                </ul>
              </div>
              <div className='flex gap-2'>
                <Button variant='outline' onClick={loadTagStatistics}>
                  刷新统计
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
