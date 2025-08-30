import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, TrendingDown, Target, MousePointer, Eye, Send } from 'lucide-react'

interface PushEffectAnalysisProps {
  className?: string
  metrics: {
    successRate: number
    clickRate: number
    openRate: number
    avgDailyPushes: number
  }
  loading?: boolean
}

export function PushEffectAnalysis({ metrics, loading = false, className }: PushEffectAnalysisProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="mr-2 h-5 w-5" />
            推送效果分析
          </CardTitle>
          <CardDescription>
            分析推送消息的点击率和转化效果
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

  const getRateBadge = (rate: number) => {
    if (rate >= 80) return 'default'
    if (rate >= 60) return 'secondary'
    return 'destructive'
  }

  const formatRate = (rate: number) => `${rate.toFixed(1)}%`

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Target className="mr-2 h-5 w-5" />
          推送效果分析
        </CardTitle>
        <CardDescription>
          分析推送消息的点击率和转化效果
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 成功率 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">推送成功率</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={getRateBadge(metrics.successRate)}>
                  {formatRate(metrics.successRate)}
                </Badge>
                {metrics.successRate >= 80 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
            <Progress value={metrics.successRate} className="h-2" />
            <p className="text-sm text-muted-foreground">
              推送消息成功送达率，影响用户接收体验
            </p>
          </div>

          {/* 点击率 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MousePointer className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">推送点击率</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={getRateBadge(metrics.clickRate)}>
                  {formatRate(metrics.clickRate)}
                </Badge>
                {metrics.clickRate >= 5 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
            <Progress value={Math.min(metrics.clickRate * 10, 100)} className="h-2" />
            <p className="text-sm text-muted-foreground">
              用户点击推送消息的比例，反映推送内容吸引力
            </p>
          </div>

          {/* 打开率 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">推送打开率</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={getRateBadge(metrics.openRate)}>
                  {formatRate(metrics.openRate)}
                </Badge>
                {metrics.openRate >= 10 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
            <Progress value={Math.min(metrics.openRate * 5, 100)} className="h-2" />
            <p className="text-sm text-muted-foreground">
              用户打开推送消息的比例，反映推送质量
            </p>
          </div>

          {/* 平均日推送量 */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">平均日推送量</span>
              </div>
              <div className="text-2xl font-bold text-primary">
                {metrics.avgDailyPushes.toFixed(1)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              每日平均推送消息数量
            </p>
          </div>

          {/* 效果建议 */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">优化建议</h4>
            <div className="space-y-1">
              {metrics.successRate < 80 && (
                <p className="text-sm text-muted-foreground">
                  • 推送成功率偏低，建议检查设备token有效性和推送服务配置
                </p>
              )}
              {metrics.clickRate < 5 && (
                <p className="text-sm text-muted-foreground">
                  • 点击率较低，建议优化推送标题和内容，提升吸引力
                </p>
              )}
              {metrics.openRate < 10 && (
                <p className="text-sm text-muted-foreground">
                  • 打开率较低，考虑调整推送频率和内容质量
                </p>
              )}
              {metrics.successRate >= 80 && metrics.clickRate >= 5 && metrics.openRate >= 10 && (
                <p className="text-sm text-green-600">
                  • 推送效果良好，继续保持当前策略
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
