/**
 * Android推送厂商常量定义
 * 统一管理所有Android厂商相关的常量，避免重复定义
 */

// Android厂商信息映射
export const ANDROID_VENDORS = {
  huawei: { name: '华为推送', displayName: '华为', fullName: '华为推送 (HMS Push)' },
  xiaomi: { name: '小米推送', displayName: '小米', fullName: '小米推送 (Mi Push)' },
  oppo: { name: 'OPPO推送', displayName: 'OPPO', fullName: 'OPPO推送 (OPPO Push)' },
  vivo: { name: 'VIVO推送', displayName: 'VIVO', fullName: 'VIVO推送 (VIVO Push)' },
  honor: { name: '荣耀推送', displayName: '荣耀', fullName: '荣耀推送 (Honor Push)' },
  samsung: { name: '三星推送', displayName: '三星', fullName: '三星推送 (Samsung Push)' },
} as const

// Android厂商键数组
export const ANDROID_VENDOR_KEYS = Object.keys(ANDROID_VENDORS) as (keyof typeof ANDROID_VENDORS)[]

// Android厂商选择选项（用于Select组件）
export const ANDROID_VENDOR_OPTIONS = [
  { value: 'all', label: '全部厂商' },
  ...ANDROID_VENDOR_KEYS.map(key => ({
    value: key,
    label: ANDROID_VENDORS[key].displayName
  }))
] as const

// Android厂商配置选项（用于配置选择）
export const ANDROID_VENDOR_CONFIG_OPTIONS = ANDROID_VENDOR_KEYS.map(key => ({
  value: key,
  label: ANDROID_VENDORS[key].fullName
}))

// Android厂商信息获取函数
export const getAndroidVendorInfo = (vendor: string) => {
  return ANDROID_VENDORS[vendor as keyof typeof ANDROID_VENDORS] || {
    name: vendor,
    displayName: vendor,
    fullName: vendor
  }
}

// Android厂商图标映射（用于UI显示）
export const ANDROID_VENDOR_ICONS = {
  huawei: '📱',
  xiaomi: '📱',
  oppo: '📱',
  vivo: '📱',
  honor: '📱',
  samsung: '📱',
} as const
