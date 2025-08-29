import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2, Plus, X } from 'lucide-react'
import { TagService } from '@/services/tag-service'
import type { TagFilter, TagStatistic } from '@/types/api'
import { toast } from 'sonner'

interface TagSelectorProps {
  appId: number
  value: TagFilter[]
  onChange: (tags: TagFilter[]) => void
}

export function TagSelector({ appId, value, onChange }: TagSelectorProps) {
  const [availableTags, setAvailableTags] = useState<TagStatistic[]>([])
  const [tagMaxCount, setTagMaxCount] = useState(0)
  const [newTagName, setNewTagName] = useState('')
  const [newTagValue, setNewTagValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const loadAvailableTags = useCallback(async (search: string) => {
    try {
      setIsSearching(true)
      const stats = await TagService.getTagStatisticsSimple(appId, search, 50)
      setTagMaxCount(prev => Math.max(prev, stats?.length || 0))
      setAvailableTags(stats || [])
    } catch (error) {
      console.error('加载标签统计失败:', error)
    } finally {
      setIsSearching(false)
    }
  }, [appId])

  // 搜索防抖处理
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadAvailableTags(searchQuery)
    }, searchQuery.length > 0 ? 300 : 0)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, loadAvailableTags])

  const addTag = () => {
    if (!newTagName.trim()) {
      toast.error('标签名称不能为空')
      return
    }

    const newTag: TagFilter = {
      tag_name: newTagName.trim(),
      tag_value: newTagValue.trim() || undefined,
    }

    // 检查是否已存在相同的标签
    const exists = value.some(
      tag => tag.tag_name === newTag.tag_name && tag.tag_value === newTag.tag_value
    )

    if (!exists) {
      onChange([...value, newTag])
      setNewTagName('')
      setNewTagValue('')
    }
  }

  const removeTag = (index: number) => {
    const newTags = value.filter((_, i) => i !== index)
    onChange(newTags)
  }

  const addFromSuggestion = (stat: TagStatistic) => {
    const newTag: TagFilter = {
      tag_name: stat.tag_name,
      tag_value: stat.tag_value,
    }

    // 检查是否已存在相同的标签
    const exists = value.some(
      tag => tag.tag_name === newTag.tag_name && tag.tag_value === newTag.tag_value
    )

    if (!exists) {
      onChange([...value, newTag])
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">标签筛选条件</CardTitle>
        <CardDescription>
          选择或添加标签来定位目标设备，支持多个标签条件（OR逻辑）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 当前选中的标签 */}
        {value.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">已选择的标签：</Label>
            <div className="flex flex-wrap gap-2">
              {value.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1 pr-0.5">
                  <span>
                    {tag.tag_name}
                    {tag.tag_value && `=${tag.tag_value}`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6"
                    onClick={() => removeTag(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 添加新标签 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">添加标签筛选：</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="标签名称"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
              />
            </div>
            <div className="flex-1">
              <Input
                placeholder="标签值（可选）"
                value={newTagValue}
                onChange={(e) => setNewTagValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
              />
            </div>
            <Button type="button" onClick={addTag} size="icon" className="shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            留空标签值表示匹配该标签名称的所有设备，无论标签值是什么
          </p>
        </div>

        {/* 现有标签建议 */}
        {(searchQuery || tagMaxCount > 0) && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">从现有标签中选择：</Label>
            <div className="relative">
              <Input
                placeholder="搜索标签名称或标签值..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm"
              />
              {isSearching && (
                <Loader2 className="h-4 w-4 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
              )}
            </div>
            {availableTags.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                {availableTags.map((stat, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded border hover:bg-muted cursor-pointer"
                    onClick={() => addFromSuggestion(stat)}
                  >
                    <div className="flex-1">
                      <span className="font-medium">{stat.tag_name}</span>
                      <span className="text-muted-foreground"> = {stat.tag_value}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {stat.device_count} 设备
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {searchQuery ? '没有找到匹配的标签' : '暂无标签数据'}
              </p>
            )}
          </div>
        )}

        {value.length === 0 && (
          <p className="text-sm text-muted-foreground">
            请至少添加一个标签筛选条件
          </p>
        )}
      </CardContent>
    </Card>
  )
}
