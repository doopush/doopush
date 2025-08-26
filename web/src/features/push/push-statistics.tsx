import { useEffect, useState } from 'react'
import { 
  BarChart3, 
  TrendingUp, 
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

import { useAuthStore } from '@/stores/auth-store'
import { PushService } from '@/services/push-service'
import { NoAppSelected } from '@/components/no-app-selected'
import { APP_SELECTION_DESCRIPTIONS } from '@/utils/app-utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

// 模拟统计数据
const generateMockData = () => {
  const dailyData = []
  const now = new Date()
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    
    const total = Math.floor(Math.random() * 1000) + 200
    const success = Math.floor(total * (0.85 + Math.random() * 0.1))
    const failed = total - success
    
    dailyData.push({
      date: date.toISOString().split('T')[0],
      dateDisplay: date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      }),
      total,
      success,
      failed,
      click: Math.floor(success * (0.15 + Math.random() * 0.1)),
      open: Math.floor(success * (0.6 + Math.random() * 0.2)),
    })
  }
  
  return dailyData
}

const platformData = [
  { name: 'iOS', value: 2400, color: '#007AFF' },
  { name: 'Android', value: 3600, color: '#34C759' },
]

const vendorData = [
  { name: '华为', value: 1200, color: '#FF3B30' },
  { name: '小米', value: 800, color: '#FF9500' },
  { name: '谷歌', value: 600, color: '#007AFF' },
  { name: 'OPPO', value: 500, color: '#32D74B' },
  { name: 'VIVO', value: 400, color: '#5856D6' },
  { name: '其他', value: 100, color: '#8E8E93' },
]

interface DailyStat {
  date: string
  dateDisplay: string
  total: number
  success: number
  failed: number
  click: number
  open: number
}

export default function PushStatistics() {
  const { currentApp } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')
  const [dailyData, setDailyData] = useState<DailyStat[]>([])
  const [totalStats, setTotalStats] = useState({
    total_pushes: 0,
    success_pushes: 0,
    failed_pushes: 0,
    total_devices: 0,
  })

  // 加载统计数据
  useEffect(() => {
    if (currentApp) {
      loadStatistics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentApp, timeRange])

  const loadStatistics = async () => {
    try {
      setLoading(true)
      
      // 加载基础统计
      const stats = await PushService.getPushStatistics(currentApp!.id)
      setTotalStats(stats)
      
      // 生成模拟的时间序列数据
      const mockDaily = generateMockData()
      setDailyData(mockDaily)
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const successRate = totalStats.total_pushes > 0 
    ? ((totalStats.success_pushes / totalStats.total_pushes) * 100).toFixed(1)
    : '0'

  const clickRate = dailyData.length > 0 
    ? ((dailyData.reduce((sum, item) => sum + item.click, 0) / dailyData.reduce((sum, item) => sum + item.success, 0)) * 100).toFixed(1)
    : '0'

  const openRate = dailyData.length > 0 
    ? ((dailyData.reduce((sum, item) => sum + item.open, 0) / dailyData.reduce((sum, item) => sum + item.success, 0)) * 100).toFixed(1)
    : '0'

  return (
    <>
      <Header>
        <Search />
        <div className='ms-auto flex items-center gap-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {!currentApp ? (
        <NoAppSelected 
          icon={<BarChart3 className="h-16 w-16 text-muted-foreground" />}
          description={APP_SELECTION_DESCRIPTIONS.pushStatistics}
        />
      ) : (
        <Main>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex flex-col gap-1'>
                <h1 className='text-2xl font-bold tracking-tight'>推送统计</h1>
                <p className='text-muted-foreground'>
                  应用 "{currentApp.name}" 的详细推送数据分析
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">近7天</SelectItem>
                    <SelectItem value="30d">近30天</SelectItem>
                    <SelectItem value="90d">近90天</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={loadStatistics}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </Button>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  导出报告
                </Button>
              </div>
            </div>

            {/* 概览统计卡片 */}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>推送成功率</CardTitle>
                  <TrendingUp className='text-muted-foreground h-4 w-4' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-green-600'>
                    {loading ? '...' : successRate}%
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    {loading ? '...' : `${totalStats.success_pushes}/${totalStats.total_pushes}`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>点击率</CardTitle>
                  <Calendar className='text-muted-foreground h-4 w-4' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-blue-600'>
                    {loading ? '...' : clickRate}%
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    用户点击推送的比率
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>打开率</CardTitle>
                  <BarChart3 className='text-muted-foreground h-4 w-4' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-purple-600'>
                    {loading ? '...' : openRate}%
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    用户打开应用的比率
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>活跃设备</CardTitle>
                  <Calendar className='text-muted-foreground h-4 w-4' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {loading ? '...' : totalStats.total_devices.toLocaleString()}
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    可接收推送的设备数
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 详细统计图表 */}
            <Tabs defaultValue="trend" className="space-y-4">
              <TabsList>
                <TabsTrigger value="trend">推送趋势</TabsTrigger>
                <TabsTrigger value="platform">平台分布</TabsTrigger>
                <TabsTrigger value="vendor">厂商分析</TabsTrigger>
                <TabsTrigger value="engagement">用户参与</TabsTrigger>
              </TabsList>
              
              <TabsContent value="trend" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>推送数量趋势</CardTitle>
                    <CardDescription>
                      过去{timeRange === '7d' ? '7' : timeRange === '30d' ? '30' : '90'}天的推送数据变化
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="dateDisplay" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="total" 
                          stroke="#8884d8" 
                          name="总推送"
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="success" 
                          stroke="#10b981" 
                          name="成功推送"
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="failed" 
                          stroke="#ef4444" 
                          name="失败推送"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="platform" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>平台分布</CardTitle>
                      <CardDescription>不同平台的推送数量分布</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={platformData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent ? (percent * 100).toFixed(0) : 0)}%`}
                          >
                            {platformData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>平台推送柱状图</CardTitle>
                      <CardDescription>各平台推送数量对比</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={platformData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="vendor" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Android厂商分布</CardTitle>
                    <CardDescription>不同Android厂商的推送分布情况</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={vendorData} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={60} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#34C759" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="engagement" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>用户参与度趋势</CardTitle>
                    <CardDescription>用户对推送消息的点击和打开行为分析</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="dateDisplay" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="click" 
                          stroke="#007AFF" 
                          name="点击数"
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="open" 
                          stroke="#34C759" 
                          name="打开数"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
        </Main>
      )}
    </>
  )
}
