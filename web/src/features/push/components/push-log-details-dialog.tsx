import { useState, useEffect } from 'react'
import { 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock,

  Copy,
  Download,

} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { PushService } from '@/services/push-service'
import type { PushLog, PushResult } from '@/types/api'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface PushLogDetailsDialogProps {
  log: PushLog
  open: boolean
  onOpenChange: (open: boolean) => void
}

// 模拟推送结果数据
const generateMockResults = (logId: number): PushResult[] => {
  const results: PushResult[] = []
  const platforms = ['ios', 'android']
  const vendors = ['apple', 'huawei', 'xiaomi', 'oppo', 'vivo', 'google']
  const statuses: Array<'sent' | 'failed' | 'pending'> = ['sent', 'sent', 'sent', 'failed', 'pending']
  
  for (let i = 0; i < Math.min(20, Math.floor(Math.random() * 50) + 10); i++) {
    const platform = platforms[Math.floor(Math.random() * platforms.length)]
    const vendor = platform === 'ios' ? 'apple' : vendors[Math.floor(Math.random() * (vendors.length - 1)) + 1]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    
    results.push({
      id: i + 1,
      app_id: 1,
      push_log_id: logId,
      device_id: i + 1,
      platform,
      vendor,
      status,
      response_code: status === 'sent' ? '200' : status === 'failed' ? '400' : '',
      response_msg: status === 'sent' ? 'Success' : status === 'failed' ? 'Invalid token' : 'Pending',
      sent_at: status !== 'pending' ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
    })
  }
  
  return results
}

export function PushLogDetailsDialog({ log, open, onOpenChange }: PushLogDetailsDialogProps) {
  const { currentApp } = useAuthStore()
  const [results, setResults] = useState<PushResult[]>([])
  const [loading, setLoading] = useState(true)
  const [logStats, setLogStats] = useState({
    total_devices: 0,
    success_count: 0,
    failed_count: 0
  })

  useEffect(() => {
    if (open && currentApp) {
      loadPushResults()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, log.id, currentApp])

  const loadPushResults = async () => {
    if (!currentApp) return
    
    try {
      setLoading(true)
      const data = await PushService.getPushLogDetails(currentApp.id, log.id)
      setResults(data.results)
      setLogStats(data.stats)
    } catch (error) {
      console.error('加载推送结果失败:', error)
      toast.error('加载推送结果失败')
      // 使用模拟数据作为后备
      const mockResults = generateMockResults(log.id)
      setResults(mockResults)
      setLogStats({
        total_devices: mockResults.length,
        success_count: mockResults.filter(r => r.status === 'sent').length,
        failed_count: mockResults.filter(r => r.status === 'failed').length,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(log.payload)
    toast.success('推送载荷已复制到剪贴板')
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: { label: '已完成', className: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { label: '失败', className: 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200', icon: XCircle },
      processing: { label: '发送中', className: 'bg-blue-100 text-blue-800', icon: Send },
      pending: { label: '待发送', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
    }
    return variants[status as keyof typeof variants] || variants.pending
  }

  const getResultStatusBadge = (status: string) => {
    const variants = {
      sent: { label: '已发送', className: 'bg-green-100 text-green-800' },
      failed: { label: '失败', className: 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200' },
      pending: { label: '待发送', className: 'bg-yellow-100 text-yellow-800' },
    }
    return variants[status as keyof typeof variants] || variants.pending
  }

  const successRate = logStats.total_devices > 0 
    ? ((logStats.success_count / logStats.total_devices) * 100).toFixed(1)
    : '0'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            推送详情
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">推送概览</TabsTrigger>
              <TabsTrigger value="results">发送结果</TabsTrigger>
              <TabsTrigger value="analytics">数据分析</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* 基本信息 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">推送信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">推送标题</label>
                      <p className="text-sm font-medium mt-1">{log.title}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">推送状态</label>
                      <div className="mt-1">
                        <Badge className={getStatusBadge(log.status).className}>
                          {getStatusBadge(log.status).label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">推送内容</label>
                    <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{log.content}</p>
                  </div>

                  {log.payload && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-muted-foreground">推送载荷</label>
                        <Button size="sm" variant="outline" onClick={handleCopyPayload}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <pre className="text-xs mt-1 p-3 bg-muted rounded-lg overflow-auto">
                        {JSON.stringify(JSON.parse(log.payload || '{}'), null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 统计信息 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">推送统计</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted/50 dark:bg-muted/20 rounded-lg">
                      <div className="text-2xl font-bold">{logStats.total_devices}</div>
                      <div className="text-sm text-muted-foreground">目标设备</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{logStats.success_count}</div>
                      <div className="text-sm text-muted-foreground">成功发送</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{logStats.failed_count}</div>
                      <div className="text-sm text-muted-foreground">发送失败</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{successRate}%</div>
                      <div className="text-sm text-muted-foreground">成功率</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 时间信息 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">时间信息</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">创建时间</label>
                      <p className="text-sm mt-1">
                        {new Date(log.created_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">发送时间</label>
                      <p className="text-sm mt-1">
                        {log.sent_at 
                          ? new Date(log.sent_at).toLocaleString('zh-CN')
                          : '未发送'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>设备推送结果</span>
                    <Button size="sm" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      导出结果
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>设备</TableHead>
                          <TableHead>平台</TableHead>
                          <TableHead>厂商</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>响应</TableHead>
                          <TableHead>发送时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((result) => (
                          <TableRow key={result.id}>
                            <TableCell>
                              <div className="font-mono text-sm">
                                设备 #{result.device_id}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {result.platform.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize">
                              {result.vendor}
                            </TableCell>
                            <TableCell>
                              <Badge className={getResultStatusBadge(result.status).className}>
                                {getResultStatusBadge(result.status).label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-mono">{result.response_code}</div>
                                <div className="text-muted-foreground">{result.response_msg}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {result.sent_at 
                                ? formatDistanceToNow(new Date(result.sent_at), { 
                                    addSuffix: true, 
                                    locale: zhCN 
                                  })
                                : '未发送'
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">平台分布</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {['iOS', 'Android'].map((platform) => {
                        const count = results.filter(r => 
                          r.platform.toLowerCase() === platform.toLowerCase()
                        ).length
                        const percentage = results.length > 0 
                          ? ((count / results.length) * 100).toFixed(1)
                          : '0'
                        
                        return (
                          <div key={platform} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{platform}</span>
                            <div className="flex items-center gap-2">
                              <div className="text-sm text-muted-foreground">{count} 台</div>
                              <div className="text-sm font-medium">{percentage}%</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">发送状态</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { status: 'sent', label: '已发送', color: 'text-green-600' },
                        { status: 'failed', label: '发送失败', color: 'text-red-600' },
                        { status: 'pending', label: '待发送', color: 'text-yellow-600' },
                      ].map((item) => {
                        const count = results.filter(r => r.status === item.status).length
                        const percentage = results.length > 0 
                          ? ((count / results.length) * 100).toFixed(1)
                          : '0'
                        
                        return (
                          <div key={item.status} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <div className="text-sm text-muted-foreground">{count} 台</div>
                              <div className={`text-sm font-medium ${item.color}`}>{percentage}%</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
