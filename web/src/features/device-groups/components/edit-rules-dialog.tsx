import { useState, useEffect } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DeviceService } from '@/services/device-service'
import { toast } from 'sonner'
import type { App, DeviceGroup } from '@/types/api'
import type { FilterRule } from '@/services/group-service'

interface EditRulesDialogProps {
  app: App
  group: DeviceGroup | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditRulesDialog({ 
  app, 
  group,
  open, 
  onOpenChange, 
  onSuccess 
}: EditRulesDialogProps) {
  const [editing, setEditing] = useState(false)
  const [filterRules, setFilterRules] = useState<FilterRule[]>([])

  // 当group变化时，重置规则数据
  useEffect(() => {
    if (group && open) {
      try {
        const rules = JSON.parse(group.conditions) as FilterRule[]
        setFilterRules(rules || [])
      } catch {
        setFilterRules([])
      }
    }
  }, [group, open])

  const handleSubmit = async () => {
    if (!group) return

    try {
      setEditing(true)
      
      await DeviceService.updateDeviceGroup(app.id, group.id, {
        name: group.name,
        description: group.description,
        is_active: group.status === 1,
        filter_rules: filterRules
      })
      
      toast.success('筛选规则更新成功')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error((error as Error).message || '更新筛选规则失败')
    } finally {
      setEditing(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  // 添加筛选规则
  const addFilterRule = () => {
    const newRule: FilterRule = {
      field: 'platform',
      operator: 'in',
      value: { string_values: ['ios', 'android'] }
    }
    setFilterRules([...filterRules, newRule])
  }

  // 删除筛选规则
  const removeFilterRule = (index: number) => {
    setFilterRules(filterRules.filter((_, i) => i !== index))
  }

  // 更新筛选规则
  const updateFilterRule = (index: number, rule: FilterRule) => {
    const updatedRules = [...filterRules]
    updatedRules[index] = rule
    setFilterRules(updatedRules)
  }

  if (!group) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>编辑筛选规则</DialogTitle>
          <DialogDescription>
            为分组 "{group.name}" 配置设备筛选条件
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6 space-y-4">
          {filterRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
              暂无筛选规则，点击下方按钮添加
            </div>
          ) : (
            filterRules.map((rule, index) => (
              <div key={index} className="flex gap-3 items-start border rounded-lg p-3">
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">字段</label>
                    <Select
                      value={rule.field}
                      onValueChange={(value) => updateFilterRule(index, { ...rule, field: value })}
                    >
                      <SelectTrigger className='w-full min-w-0'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="platform">平台</SelectItem>
                        <SelectItem value="brand">品牌</SelectItem>
                        <SelectItem value="model">设备型号</SelectItem>
                        <SelectItem value="system_version">系统版本</SelectItem>
                        <SelectItem value="app_version">应用版本</SelectItem>
                        <SelectItem value="channel">推送通道</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">操作符</label>
                    <Select
                      value={rule.operator}
                      onValueChange={(value: 'equals' | 'contains' | 'in' | 'not_in' | 'is_null' | 'is_not_null') => updateFilterRule(index, { ...rule, operator: value })}
                    >
                      <SelectTrigger className='w-full min-w-0'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">等于</SelectItem>
                        <SelectItem value="contains">包含</SelectItem>
                        <SelectItem value="in">包含于</SelectItem>
                        <SelectItem value="not_in">不包含于</SelectItem>
                        <SelectItem value="is_null">为空</SelectItem>
                        <SelectItem value="is_not_null">不为空</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">值</label>
                    {rule.operator === 'is_null' || rule.operator === 'is_not_null' ? (
                      <div className="text-sm text-muted-foreground pt-2">无需设置值</div>
                    ) : rule.operator === 'in' || rule.operator === 'not_in' ? (
                      <Input
                        placeholder="用逗号分隔多个值"
                        value={rule.value.string_values?.join(', ') || ''}
                        onChange={(e) => updateFilterRule(index, {
                          ...rule,
                          value: { string_values: e.target.value.split(',').map(v => v.trim()).filter(v => v) }
                        })}
                      />
                    ) : (
                      <Input
                        placeholder="输入值"
                        value={rule.value.string_value || ''}
                        onChange={(e) => updateFilterRule(index, {
                          ...rule,
                          value: { string_value: e.target.value }
                        })}
                      />
                    )}
                  </div>
                </div>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFilterRule(index)}
                  className="text-red-600 hover:text-red-700 mt-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
          
          <Button
            type="button"
            variant="outline"
            onClick={addFilterRule}
            className="w-full border-dashed"
          >
            <Plus className="mr-2 h-4 w-4" />
            添加筛选条件
          </Button>
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
          <Button onClick={handleSubmit} disabled={editing}>
            {editing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存规则
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
