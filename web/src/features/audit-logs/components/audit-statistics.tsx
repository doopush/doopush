import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { AuditService } from '@/services/audit-service'
import type { OperationStat, UserActivityStat } from '@/types/api'
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Users, 
  Activity
} from 'lucide-react'

interface AuditStatisticsProps {
  dateRange?: {
    start_time?: string
    end_time?: string
  }
}

interface AuditStatisticsRef {
  refreshStatistics: () => Promise<void>
}

export const AuditStatistics = forwardRef<AuditStatisticsRef, AuditStatisticsProps>(({ dateRange }, ref) => {
  const { currentApp } = useAuthStore()
  const [operationStats, setOperationStats] = useState<OperationStat[]>([])
  const [userActivityStats, setUserActivityStats] = useState<UserActivityStat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const loadingRef = useRef(false)

  useEffect(() => {
    loadStatistics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp?.id, dateRange])

  useImperativeHandle(ref, () => ({
    refreshStatistics: loadStatistics
  }))

  const loadStatistics = async () => {
    // 防止重复调用
    if (loadingRef.current) {
      return
    }
    
    try {
      loadingRef.current = true
      setIsLoading(true)
      // 统计接口按天数（days）统计；如传入时间范围，则换算成天数
      let days = 30
      if (dateRange?.start_time && dateRange?.end_time) {
        const start = new Date(dateRange.start_time).getTime()
        const end = new Date(dateRange.end_time).getTime()
        if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
          const diffDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000))
          days = Math.max(1, Math.min(365, diffDays))
        }
      }

      const params = {
        days,
        limit: 10,
      }

      if (!currentApp?.id) {
        // 未选择应用时，清空统计数据
        setOperationStats([])
        setUserActivityStats([])
        return
      }

      const [operationData, userActivityData] = await Promise.all([
        AuditService.getAppOperationStatistics(currentApp.id, params),
        AuditService.getAppUserActivityStatistics(currentApp.id, params)
      ])

      // 确保返回的数据是数组格式
      setOperationStats(Array.isArray(operationData) ? operationData : [])
      setUserActivityStats(Array.isArray(userActivityData) ? userActivityData : [])
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      loadingRef.current = false
      setIsLoading(false)
    }
  }

  // 计算操作类型分布百分比
  const getOperationDistribution = () => {
    if (!Array.isArray(operationStats) || operationStats.length === 0) {
      return []
    }
    const total = operationStats.reduce((sum, stat) => sum + stat.count, 0)
    return operationStats.map(stat => ({
      ...stat,
      percentage: total > 0 ? (stat.count / total * 100).toFixed(1) : '0'
    }))
  }

  // 获取操作类型颜色
  const getOperationColor = (action: string) => {
    const colors: Record<string, string> = {
      create: 'bg-green-500',
      update: 'bg-blue-500',
      delete: 'bg-red-500',
      push: 'bg-purple-500',
      default: 'bg-gray-500'
    }
    return colors[action] || colors.default
  }

  const getOperationLabel = (stat: OperationStat) => {
    return stat.action_label || stat.action
  }

  const getResourceLabel = (stat: OperationStat) => {
    return stat.resource_label || stat.resource
  }

  // 简单饼图组件
  const SimplePieChart = ({ data }: { data: Array<{ label: string; count: number; percentage: string; color: string }> }) => {
    let currentAngle = 0
    
    return (
      <div className="flex items-center justify-center">
        <div className="relative">
          <svg width="200" height="200" className="transform -rotate-90">
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            {data.map((item, index) => {
              const totalCount = data.reduce((sum, d) => sum + d.count, 0)
              const angle = totalCount > 0 ? (item.count / totalCount) * 360 : 0
              const strokeDasharray = 2 * Math.PI * 80
              const strokeDashoffset = strokeDasharray - (strokeDasharray * angle) / 360
              const result = (
                <circle
                  key={index}
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke={item.color.replace('bg-', '').replace('-500', '')}
                  strokeWidth="8"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  transform={`rotate(${currentAngle} 100 100)`}
                  className={item.color}
                />
              )
              currentAngle += angle
              return result
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {Array.isArray(data) ? data.reduce((sum, d) => sum + d.count, 0) : 0}
              </div>
              <div className="text-xs text-muted-foreground">总操作</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const operationDistribution = getOperationDistribution()
  const pieChartData = operationDistribution.map(stat => ({
    label: `${getOperationLabel(stat)} ${getResourceLabel(stat)}`,
    count: stat.count,
    percentage: stat.percentage,
    color: getOperationColor(stat.action)
  }))

  return (
    <>
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center flex-row-reverse justify-between space-x-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">总操作数</p>
                <p className="text-2xl font-bold">
                  {Array.isArray(operationStats) ? operationStats.reduce((sum, stat) => sum + stat.count, 0) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center flex-row-reverse justify-between space-x-2">
              <BarChart3 className="h-4 w-4 text-green-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">操作类型</p>
                <p className="text-2xl font-bold">{Array.isArray(operationStats) ? operationStats.length : 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center flex-row-reverse justify-between space-x-2">
              <Users className="h-4 w-4 text-purple-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">活跃用户</p>
                <p className="text-2xl font-bold">{Array.isArray(userActivityStats) ? userActivityStats.length : 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center flex-row-reverse justify-between space-x-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">平均操作</p>
                <p className="text-2xl font-bold">
                  {Array.isArray(userActivityStats) && userActivityStats.length > 0 && Array.isArray(operationStats)
                    ? Math.round(operationStats.reduce((sum, stat) => sum + stat.count, 0) / userActivityStats.length)
                    : 0
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 操作类型分布饼图 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              操作类型分布
            </CardTitle>
            <CardDescription>
              显示不同操作类型的统计分布
            </CardDescription>
          </CardHeader>
          <CardContent>
            {operationDistribution.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                <SimplePieChart data={pieChartData} />
                <div className="space-y-3">
                  {operationDistribution.map((stat, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getOperationColor(stat.action)}`} />
                        <div>
                          <div className="font-medium text-sm">
                            {getOperationLabel(stat)} {getResourceLabel(stat)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {stat.percentage}% of total
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {stat.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                暂无操作数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 活跃用户排行 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              活跃用户排行
            </CardTitle>
            <CardDescription>
              操作频次最高的用户
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Array.isArray(userActivityStats) && userActivityStats.length > 0 ? (
              <div className="space-y-3">
                {userActivityStats.slice(0, 10).map((user, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {user.user_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          最后活动: {new Date(user.last_activity).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {user.action_count}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                暂无用户活动数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
})

AuditStatistics.displayName = 'AuditStatistics'