import type { AppSecretScope } from '@/types/api'

export const APP_SECRET_SCOPES: Array<{
  value: AppSecretScope
  label: string
  description: string
  highRisk?: boolean
}> = [
  { value: 'push:send', label: '发送推送', description: '向指定设备、用户、标签或分组发送推送' },
  { value: 'push:broadcast', label: '全量广播', description: '向应用全部设备发送推送', highRisk: true },
  { value: 'push:schedule', label: '定时推送', description: '通过通用推送接口创建定时发送' },
]

export function scopeLabel(scope: AppSecretScope) {
  return APP_SECRET_SCOPES.find((item) => item.value === scope)?.label ?? scope
}
