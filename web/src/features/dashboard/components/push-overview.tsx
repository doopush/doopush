import { useEffect, useState } from 'react'

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface ChartDataPoint {
  date: string
  total: number
  success: number
  failed: number
}

interface PushOverviewProps {
  dailyStats?: Array<{
    date: string
    total_pushes: number
    success_pushes: number
    failed_pushes: number
    click_count: number
    open_count: number
  }>
  loading?: boolean
}

export function PushOverview({ dailyStats, loading = false }: PushOverviewProps) {
  const [data, setData] = useState<ChartDataPoint[]>([])

  useEffect(() => {
    if (dailyStats) {
      // 转换数据格式用于图表显示
      const chartData = dailyStats.map(stat => ({
        date: stat.date,
        dateDisplay: new Date(stat.date).toLocaleDateString('zh-CN', {
          month: 'short',
          day: 'numeric'
        }),
        total: stat.total_pushes,
        success: stat.success_pushes,
        failed: stat.failed_pushes,
      }))

      // 如果没有数据，显示空状态
      if (chartData.length === 0) {
        setData([])
      } else {
        // 按日期排序（最旧的在前）
        chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        setData(chartData)
      }
    } else {
      setData([])
    }
  }, [dailyStats])

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-lg mb-2">暂无数据</div>
          <div className="text-sm">开始发送推送后，趋势图将在这里显示</div>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <XAxis
          dataKey="dateDisplay"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3">
                  <p className="font-medium mb-2">{label}</p>
                  {payload.map((entry, index) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                      {entry.name}: {entry.value}
                    </p>
                  ))}
                </div>
              )
            }
            return null
          }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#8884d8"
          fillOpacity={1}
          fill="url(#colorTotal)"
          name="总推送"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="success"
          stroke="#10b981"
          fillOpacity={1}
          fill="url(#colorSuccess)"
          name="成功推送"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="failed"
          stroke="#ef4444"
          fillOpacity={1}
          fill="url(#colorFailed)"
          name="失败推送"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
