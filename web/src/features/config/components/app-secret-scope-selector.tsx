import { CalendarClock, RadioTower, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppSecretScope } from '@/types/api'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { APP_SECRET_SCOPES } from './app-secret-scopes'

interface Props {
  scopes: AppSecretScope[]
  onChange: (scopes: AppSecretScope[]) => void
  idPrefix: string
}

export function AppSecretScopeSelector({ scopes, onChange, idPrefix }: Props) {
  const toggleScope = (scope: AppSecretScope, checked: boolean) => {
    onChange(checked
      ? scopes.includes(scope) ? scopes : [...scopes, scope]
      : scopes.filter((item) => item !== scope))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <Label>权限范围</Label>
          <p className="text-xs text-muted-foreground">按最小权限原则选择服务实际需要的能力。</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">已选择 {scopes.length}</span>
      </div>
      <div className="grid gap-2.5">
        {APP_SECRET_SCOPES.map((scope) => {
          const selected = scopes.includes(scope.value)
          const ScopeIcon = scope.value === 'push:send' ? Send : scope.value === 'push:broadcast' ? RadioTower : CalendarClock
          const inputID = `${idPrefix}-${scope.value}`
          return (
            <label
              key={scope.value}
              htmlFor={inputID}
              className={cn(
                'group flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-all duration-200',
                selected
                  ? 'border-primary/60 bg-primary/[0.04] shadow-sm ring-1 ring-primary/10'
                  : 'border-border/80 bg-card hover:border-primary/30 hover:bg-muted/40 hover:shadow-sm'
              )}
            >
              <span className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-foreground'
              )}>
                <ScopeIcon className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium">{scope.label}</span>
                  {scope.highRisk && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">高风险</span>}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{scope.description}</span>
              </span>
              <Checkbox
                id={inputID}
                checked={selected}
                onCheckedChange={(checked) => toggleScope(scope.value, checked === true)}
                className="size-5 rounded-md"
              />
            </label>
          )
        })}
      </div>
      {scopes.length === 0 && <p className="text-xs font-medium text-destructive">请至少选择一个权限范围</p>}
    </div>
  )
}
