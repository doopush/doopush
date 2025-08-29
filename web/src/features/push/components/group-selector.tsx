import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { GroupService } from '@/services/group-service'
import type { DeviceGroup } from '@/types/api'

interface GroupSelectorProps {
  value: number[]
  onChange: (value: number[]) => void
  appId: number
}

export function GroupSelector({ value, onChange, appId }: GroupSelectorProps) {
  const [open, setOpen] = useState(false)
  const [groups, setGroups] = useState<DeviceGroup[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true)
      try {
        const response = await GroupService.getGroups(appId, 1, 100)
        setGroups(response.data.items)
      } catch (error) {
        console.error('获取分组失败:', error)
      } finally {
        setLoading(false)
      }
    }

    if (appId) {
      fetchGroups()
    }
  }, [appId])

  const selectedGroups = groups.filter(group => value.includes(group.id))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={loading}
        >
          {loading ? (
            '加载中...'
          ) : value.length === 0 ? (
            '选择设备分组...'
          ) : (
            `${selectedGroups.length} 个分组已选择`
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align='start'>
        <Command>
          <CommandInput placeholder="搜索分组..." />
          <CommandEmpty>没有找到分组</CommandEmpty>
          <CommandGroup>
            {groups.map((group) => (
              <CommandItem
                key={group.id}
                onSelect={() => {
                  const isSelected = value.includes(group.id)
                  if (isSelected) {
                    onChange(value.filter(id => id !== group.id))
                  } else {
                    onChange([...value, group.id])
                  }
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value.includes(group.id) ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex-1">
                  <div className="font-medium">{group.name}</div>
                  {group.description && (
                    <div className="text-sm text-muted-foreground">
                      {group.description}
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
