import { Copy, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AppConfigTab() {
  const { currentApp } = useAuthStore()

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label}已复制到剪贴板`)
    } catch (_error) {
      toast.error('复制失败，请手动复制')
    }
  }

  if (!currentApp) return null

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Settings className='h-5 w-5' />
            应用基础信息
          </CardTitle>
          <CardDescription>SDK集成所需的基础参数信息</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='app-id'>App ID</Label>
              <div className='flex items-center gap-2'>
                <Input id='app-id' value={currentApp.id.toString()} readOnly className='bg-muted' />
                <Button size='sm' variant='outline' onClick={() => copyToClipboard(currentApp.id.toString(), 'App ID')} title='复制App ID'>
                  <Copy className='h-4 w-4' />
                </Button>
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='bundle-id'>Bundle ID</Label>
              <div className='flex items-center gap-2'>
                <Input id='bundle-id' value={currentApp.package_name} readOnly className='bg-muted' />
                <Button size='sm' variant='outline' onClick={() => copyToClipboard(currentApp.package_name, 'Bundle ID')} title='复制Bundle ID'>
                  <Copy className='h-4 w-4' />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
