import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Smartphone, Monitor, CheckCircle } from 'lucide-react'
import { Apple, Android } from '@/components/platform-icon'

interface DeviceAnalysisProps {
  metrics: {
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
  loading?: boolean
}

export function DeviceAnalysis({ metrics, loading = false }: DeviceAnalysisProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Smartphone className="mr-2 h-5 w-5" />
            设备分析
          </CardTitle>
          <CardDescription>
            按设备类型和平台分析推送效果
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-2 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'ios':
        return <Apple className="h-5 w-5" />
      case 'android':
        return <Android className="h-5 w-5" />
      default:
        return <Monitor className="h-4 w-4" />
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'ios':
        return 'text-blue-600'
      case 'android':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600'
    if (rate >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatPercentage = (percentage: number) => `${percentage.toFixed(1)}%`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Smartphone className="mr-2 h-5 w-5" />
          设备分析
        </CardTitle>
        <CardDescription>
          按设备类型和平台分析推送效果
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 平台分布 */}
          <div>
            <h4 className="text-sm font-medium mb-4">平台分布</h4>
            <div className="space-y-4">
              {metrics.platformDistribution.map((platform) => (
                <div key={platform.platform} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={getPlatformColor(platform.platform)}>
                        {getPlatformIcon(platform.platform)}
                      </span>
                      <span className="text-sm font-medium capitalize">
                        {platform.platform}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        {platform.count} 次
                      </span>
                      <Badge variant="outline">
                        {formatPercentage(platform.percentage)}
                      </Badge>
                    </div>
                  </div>

                  {/* 平台推送量进度条 */}
                  <Progress value={platform.percentage} className="h-2" />

                  {/* 平台成功率 */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-1">
                      <CheckCircle className={`h-3 w-3 ${getSuccessRateColor(platform.successRate)}`} />
                      <span className="text-muted-foreground">成功率</span>
                    </div>
                    <span className={getSuccessRateColor(platform.successRate)}>
                      {platform.successRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 平台对比 */}
          {metrics.platformDistribution.length > 1 && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-4">平台对比</h4>
              <div className="grid grid-cols-2 gap-4">
                {metrics.platformDistribution.map((platform) => (
                  <div key={platform.platform} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className={getPlatformColor(platform.platform)}>
                        {getPlatformIcon(platform.platform)}
                      </span>
                      <span className="text-sm font-medium capitalize">
                        {platform.platform}
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">
                        {platform.successRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        成功率
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 分析建议 */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">分析建议</h4>
            <div className="space-y-1">
              {metrics.platformDistribution.some(p => p.successRate < 60) && (
                <p className="text-sm text-muted-foreground">
                  • 部分平台成功率较低，建议检查对应平台的推送配置
                </p>
              )}
              {metrics.platformDistribution.length === 1 && (
                <p className="text-sm text-muted-foreground">
                  • 当前仅有一个平台，建议考虑扩展到更多平台以扩大覆盖面
                </p>
              )}
              {metrics.platformDistribution.some(p => p.successRate >= 90) && (
                <p className="text-sm text-green-600">
                  • {metrics.platformDistribution.find(p => p.successRate >= 90)?.platform} 平台表现优秀
                </p>
              )}
              {metrics.platformDistribution.every(p => p.successRate >= 80) && (
                <p className="text-sm text-green-600">
                  • 所有平台推送效果良好
                </p>
              )}
            </div>
          </div>

          {/* 平台占比可视化 */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">平台占比</h4>
            <div className="flex h-2 rounded-full overflow-hidden">
              {metrics.platformDistribution.map((platform) => (
                <div
                  key={platform.platform}
                  className={`${
                    platform.platform.toLowerCase() === 'ios'
                      ? 'bg-blue-500'
                      : platform.platform.toLowerCase() === 'android'
                      ? 'bg-green-500'
                      : 'bg-gray-500'
                  }`}
                  style={{ width: `${platform.percentage}%` }}
                  title={`${platform.platform}: ${formatPercentage(platform.percentage)}`}
                />
              ))}
            </div>
            <div className="flex justify-between text-sm text-muted-foreground mt-1">
              {metrics.platformDistribution.map((platform) => (
                <span key={platform.platform} className="capitalize">
                  {platform.platform} ({formatPercentage(platform.percentage)})
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
