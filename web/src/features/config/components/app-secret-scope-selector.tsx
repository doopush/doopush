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
    const currentScopes = scopes.includes('push:send') ? scopes : ['push:send' as const, ...scopes]
    onChange(checked
      ? currentScopes.includes(scope) ? currentScopes : [...currentScopes, scope]
      : currentScopes.filter((item) => item !== scope))
  }

  const baseScope = APP_SECRET_SCOPES.find((scope) => scope.value === 'push:send')!
  const optionalScopes = APP_SECRET_SCOPES.filter((scope) => scope.value !== 'push:send')

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label>基础权限</Label>
          <p className="text-xs text-muted-foreground">App Secret 默认具备发送推送能力。</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-primary/60 bg-primary/[0.04] px-3.5 py-3 shadow-sm ring-1 ring-primary/10">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Send className="size-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{baseScope.label}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{baseScope.description}</span>
          </span>
          <Checkbox checked disabled aria-label={`${baseScope.label}（基础权限）`} className="size-5 rounded-md opacity-100" />
        </div>
      </div>
      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label>额外权限</Label>
          <p className="text-xs text-muted-foreground">按服务实际需要选择附加能力。</p>
        </div>
        <div className="grid gap-2.5">
          {optionalScopes.map((scope) => {
            const selected = scopes.includes(scope.value)
            const ScopeIcon = scope.value === 'push:broadcast' ? RadioTower : CalendarClock
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
      </div>
    </div>
  )
}
