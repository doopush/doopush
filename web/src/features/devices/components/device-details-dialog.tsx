import { Copy, Smartphone, User, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import type { Device } from '@/types/api'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface DeviceDetailsDialogProps {
  device: Device
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeviceDetailsDialog({ device, open, onOpenChange }: DeviceDetailsDialogProps) {
  const handleCopyToken = () => {
    navigator.clipboard.writeText(device.token)
    toast.success('设备Token已复制到剪贴板')
  }

  const handleCopyUserAgent = () => {
    navigator.clipboard.writeText(device.user_agent)
    toast.success('用户代理已复制到剪贴板')
  }

  const getPlatformBadge = (platform: string) => {
    const variants = {
      ios: 'bg-blue-100 text-blue-800',
      android: 'bg-green-100 text-green-800',
    }
    return variants[platform as keyof typeof variants] || 'bg-gray-100 text-gray-800'
  }

  const getStatusBadge = (status: number) => {
    return status === 1 
      ? { label: '启用', className: 'bg-green-100 text-green-800' }
      : { label: '禁用', className: 'bg-red-100 text-red-800' }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            设备详情
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本信息 */}
          <div>
            <h3 className="text-lg font-medium mb-4">基本信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">设备型号:</span>
                  <span className="text-sm font-medium">{device.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">系统版本:</span>
                  <span className="text-sm font-medium">{device.system_version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">应用版本:</span>
                  <span className="text-sm font-medium">{device.app_version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">平台:</span>
                  <Badge className={getPlatformBadge(device.platform)}>
                    {device.platform.toUpperCase()}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">品牌:</span>
                  <span className="text-sm font-medium">{device.brand}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">推送通道:</span>
                  <span className="text-sm font-medium">{device.channel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">状态:</span>
                  <Badge className={getStatusBadge(device.status).className}>
                    {getStatusBadge(device.status).label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 用户代理信息 */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <User className="h-4 w-4" />
              用户代理信息
            </h3>
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-2">
                  <p className="text-sm font-medium">用户代理</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {device.user_agent}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyUserAgent}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* 技术信息 */}
          <div>
            <h3 className="text-lg font-medium mb-4">技术信息</h3>
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-medium">设备Token</p>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {device.token}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyToken}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 时间信息 */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              时间信息
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">注册时间:</span>
                <span className="text-sm font-medium">
                  {new Date(device.created_at).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">最后更新:</span>
                <span className="text-sm font-medium">
                  {new Date(device.updated_at).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">最后活跃:</span>
                <span className="text-sm font-medium">
                  {formatDistanceToNow(new Date(device.last_seen), { 
                    addSuffix: true, 
                    locale: zhCN 
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
