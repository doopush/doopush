import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Users, Smartphone, Activity, Clock } from 'lucide-react'

interface UserActivityAnalysisProps {
  className?: string
  metrics: {
    totalDevices: number
    activeDevices: number
    activityRate: number
    avgResponseTime: number
  }
  loading?: boolean
}

export function UserActivityAnalysis({ metrics, loading = false, className }: UserActivityAnalysisProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="mr-2 h-5 w-5" />
            用户活跃度
          </CardTitle>
          <CardDescription>
            用户对推送消息的响应和活跃度统计
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-8 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const getActivityBadge = (rate: number) => {
    if (rate >= 70) return 'default'
    if (rate >= 40) return 'secondary'
    return 'destructive'
  }

  const formatRate = (rate: number) => `${rate.toFixed(1)}%`

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="mr-2 h-5 w-5" />
          用户活跃度
        </CardTitle>
        <CardDescription>
          用户对推送消息的响应和活跃度统计
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 总设备数 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">总设备数</span>
              </div>
              <div className="text-2xl font-bold text-primary">
                {metrics.totalDevices.toLocaleString()}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              已注册的设备总数
            </p>
          </div>

          {/* 活跃设备数 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">活跃设备数</span>
              </div>
              <div className="text-2xl font-bold text-primary">
                {metrics.activeDevices.toLocaleString()}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              近期有推送记录的设备数量
            </p>
          </div>

          {/* 活跃度比率 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">设备活跃度</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={getActivityBadge(metrics.activityRate)}>
                  {formatRate(metrics.activityRate)}
                </Badge>
              </div>
            </div>
            <Progress value={metrics.activityRate} className="h-2" />
            <p className="text-sm text-muted-foreground">
              活跃设备占总设备的比例
            </p>
          </div>

          {/* 平均响应时间 */}
          {metrics.avgResponseTime > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">平均响应时间</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {metrics.avgResponseTime.toFixed(1)}s
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                用户点击推送的平均响应时间
              </p>
            </div>
          )}

          {/* 活跃度建议 */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">活跃度分析</h4>
            <div className="space-y-1">
              {metrics.activityRate >= 70 && (
                <p className="text-sm text-green-600">
                  • 用户活跃度良好，推送覆盖面广
                </p>
              )}
              {metrics.activityRate < 40 && (
                <p className="text-sm text-red-600">
                  • 用户活跃度较低，建议优化推送策略或清理无效设备
                </p>
              )}
              {metrics.totalDevices < 100 && (
                <p className="text-sm text-muted-foreground">
                  • 设备数量较少，建议扩大用户规模
                </p>
              )}
              {metrics.totalDevices > 1000 && metrics.activityRate < 50 && (
                <p className="text-sm text-muted-foreground">
                  • 设备基数大但活跃度低，建议进行用户分群和精准推送
                </p>
              )}
            </div>
          </div>

          {/* 活跃度分布图示 */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span>活跃设备</span>
              <span>非活跃设备</span>
            </div>
            <div className="flex h-2 mt-2 rounded-full overflow-hidden">
              <div
                className="bg-green-500"
                style={{ width: `${metrics.activityRate}%` }}
              />
              <div
                className="bg-gray-200"
                style={{ width: `${100 - metrics.activityRate}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground mt-1">
              <span>{metrics.activeDevices} 台</span>
              <span>{metrics.totalDevices - metrics.activeDevices} 台</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
