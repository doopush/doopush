import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DeviceService } from '@/services/device-service'
import { toast } from 'sonner'
import type { App } from '@/types/api'
import type { FilterRule } from '@/services/group-service'

// 表单验证规则
const createGroupSchema = z.object({
  name: z.string().min(1, '分组名称不能为空').max(100, '名称不能超过100个字符'),
  description: z.string().max(500, '描述不能超过500个字符').optional(),
})

type CreateGroupFormData = z.infer<typeof createGroupSchema>

interface CreateGroupDialogProps {
  app: App
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateGroupDialog({ 
  app, 
  open, 
  onOpenChange, 
  onSuccess 
}: CreateGroupDialogProps) {
  const [creating, setCreating] = useState(false)

  const form = useForm<CreateGroupFormData>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })

  const handleSubmit = async (data: CreateGroupFormData) => {
    try {
      setCreating(true)
      
      // 默认筛选规则：平台为全部
      const defaultFilterRules: FilterRule[] = [
        {
          field: 'platform',
          operator: 'in',
          value: { string_values: ['ios', 'android'] }
        }
      ]
      
      await DeviceService.createDeviceGroup(app.id, {
        ...data,
        filter_rules: defaultFilterRules
      })
      
      toast.success('设备分组创建成功')
      form.reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error((error as Error).message || '创建设备分组失败')
    } finally {
      setCreating(false)
    }
  }

  const handleCancel = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>创建设备分组</DialogTitle>
          <DialogDescription>
            为应用 "{app.name}" 创建新的设备分组，支持自动筛选设备
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分组名称 *</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：VIP用户组" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分组描述</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="描述这个分组的用途和筛选条件"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={creating}
          >
            取消
          </Button>
          <Button onClick={form.handleSubmit(handleSubmit)} disabled={creating}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            创建分组
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
