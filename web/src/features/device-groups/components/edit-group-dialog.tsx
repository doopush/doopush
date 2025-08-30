import React, { useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { DeviceService } from '@/services/device-service'
import { toast } from 'sonner'
import type { App, DeviceGroup } from '@/types/api'

// 表单验证规则
const editGroupSchema = z.object({
  name: z.string().min(1, '分组名称不能为空').max(100, '名称不能超过100个字符'),
  description: z.string().max(500, '描述不能超过500个字符').optional(),
  is_active: z.boolean(),
})

type EditGroupFormData = z.infer<typeof editGroupSchema>

interface EditGroupDialogProps {
  app: App
  group: DeviceGroup | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditGroupDialog({ 
  app, 
  group,
  open, 
  onOpenChange, 
  onSuccess 
}: EditGroupDialogProps) {
  const [editing, setEditing] = useState(false)

  const form = useForm<EditGroupFormData>({
    resolver: zodResolver(editGroupSchema),
    defaultValues: {
      name: '',
      description: '',
      is_active: true,
    },
  })

  // 当group变化时，重置表单数据
  React.useEffect(() => {
    if (group && open) {
      form.reset({
        name: group.name,
        description: group.description || '',
        is_active: group.status === 1,
      })
    }
  }, [group, open, form])

  const handleSubmit = async (data: EditGroupFormData) => {
    if (!group) return

    try {
      setEditing(true)
      
      await DeviceService.updateDeviceGroup(app.id, group.id, {
        name: data.name,
        description: data.description,
        is_active: data.is_active,
        filter_rules: JSON.parse(group.conditions) // 保持原有规则不变
      })
      
      toast.success('设备分组更新成功')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error((error as Error).message || '更新设备分组失败')
    } finally {
      setEditing(false)
    }
  }

  const handleCancel = () => {
    form.reset()
    onOpenChange(false)
  }

  if (!group) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>编辑设备分组</DialogTitle>
          <DialogDescription>
            修改分组 "{group.name}" 的基本信息和状态
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

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-1.5">
                      <FormLabel>启用状态</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        启用后分组才能用于推送
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
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
            disabled={editing}
          >
            取消
          </Button>
          <Button onClick={form.handleSubmit(handleSubmit)} disabled={editing}>
            {editing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
