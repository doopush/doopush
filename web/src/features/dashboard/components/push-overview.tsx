import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// 模拟数据 - 实际项目中应该从API获取
const generateMockData = () => {
  const data = []
  const now = new Date()
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    
    // 生成模拟的推送数据
    const totalPushes = Math.floor(Math.random() * 500) + 100
    const successRate = 0.85 + Math.random() * 0.1 // 85%-95%成功率
    const successPushes = Math.floor(totalPushes * successRate)
    const failedPushes = totalPushes - successPushes
    
    data.push({
      date: date.toISOString().split('T')[0],
      dateDisplay: date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      }),
      total: totalPushes,
      success: successPushes,
      failed: failedPushes,
    })
  }
  
  return data
}

export function PushOverview() {
  const { currentApp } = useAuthStore()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentApp) {
      loadChartData()
    }
  }, [currentApp])

  const loadChartData = async () => {
    try {
      setLoading(true)
      // TODO: 实际项目中应该调用API获取历史统计数据
      // const chartData = await PushService.getPushTrendData(currentApp.id)
      
      // 目前使用模拟数据
      const mockData = generateMockData()
      setData(mockData)
    } catch (error) {
      console.error('加载图表数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
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
