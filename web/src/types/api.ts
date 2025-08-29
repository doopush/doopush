// 推送平台 API 类型定义

// ===== 用户相关 =====
export interface User {
  id: number
  username: string
  email: string
  nickname?: string
  avatar?: string
  status: number  // 1=正常, 0=禁用
  last_login?: string
  created_at: string
  updated_at: string
}

export interface UserAppPermission {
  id: number
  user_id: number
  app_id: number
  permission: 'owner' | 'developer' | 'viewer'
  created_at: string
}

// ===== 应用相关 =====
export interface App {
  id: number
  name: string
  package_name: string
  description: string
  platform: 'ios' | 'android' | 'both'
  status: number  // 1=启用, 0=禁用
  app_icon?: string
  created_by?: number
  created_at: string
  updated_at: string
}

export interface AppAPIKey {
  id: number
  app_id: number
  name: string
  key_hash: string
  key_prefix: string
  key_suffix: string
  status: number
  expires_at: string | null
  last_used: string | null
  created_at: string
  updated_at: string
  // 用于显示的字段
  last_4?: string
  permissions?: string[]
}

export interface AppConfig {
  id: number
  app_id: number
  platform: 'ios' | 'android'
  channel: string
  config: string
  created_at: string
  updated_at: string
}

// ===== 设备相关 =====
export interface Device {
  id: number
  app_id: number
  token: string
  platform: 'ios' | 'android'
  channel: string
  brand: string
  model: string
  system_version: string
  app_version: string
  user_agent: string
  status: number
  last_seen: string
  created_at: string
  updated_at: string
  app?: App
}

export interface DeviceGroup {
  id: number
  app_id: number
  name: string
  description: string
  conditions: string // JSON字符串
  status: number
  created_at: string
  updated_at: string
}

// ===== 推送相关 =====
export interface PushLog {
  id: number
  app_id: number
  device_id?: number
  device_token?: string
  device_platform?: string
  title: string
  content: string
  payload: string
  channel?: string
  target_type: string
  target_value: string
  platform_stats: string
  total_devices: number
  success_count: number
  failed_count: number
  pending_count: number
  status: 'pending' | 'processing' | 'sent' | 'failed'
  dedup_key?: string
  send_at: string | null
  created_at: string
  updated_at: string
}

export interface PushResult {
  id: number
  app_id: number
  push_log_id: number
  success: boolean
  error_code: string
  error_message: string
  response_data: string
  created_at: string
  updated_at: string
  // 可选字段 - 从关联数据中获取
  device_id?: number
  platform?: string
  vendor?: string
  status?: 'sent' | 'failed' | 'pending'
  response_code?: string
  response_msg?: string
  sent_at?: string | null
}

// ===== 模板相关 =====
export interface MessageTemplate {
  id: number
  app_id: number
  name: string
  title: string
  content: string
  payload?: string
  variables: string // JSON字符串
  platform: string
  locale: string
  version: number
  is_active: boolean
  created_by: number
  created_at: string
  updated_at: string
}

export interface TemplateVariable {
  type: string
  description: string
  default?: string
}

// ===== 设备标签 =====
export interface DeviceTag {
  id: number
  app_id: number
  device_token: string
  tag_name: string
  tag_value: string
  created_at: string
}

export interface TagStatistic {
  tag_name: string
  tag_value: string
  device_count: number
  updated_at?: string
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export interface TagStatisticsResponse {
  data: TagStatistic[]
  pagination: PaginationInfo
}

// ===== 设备分组 =====
export interface DeviceGroup {
  id: number
  app_id: number
  name: string
  description: string
  filter_rules: string // JSON字符串
  device_count: number
  status: number // 1=启用, 0=禁用
  created_at: string
  updated_at: string
}

// ===== 定时推送 =====
export interface ScheduledPush {
  id: number
  app_id: number
  name: string
  title: string
  content: string
  payload?: string
  template_id: number | null
  push_type: 'single' | 'batch' | 'broadcast' | 'groups'
  target_type: string
  target_config: string
  scheduled_at: string
  timezone: string
  repeat_type: 'once' | 'daily' | 'weekly' | 'monthly'
  repeat_config?: string
  cron_expr?: string
  next_run_at?: string
  last_run_at?: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  created_by: number
  created_at: string
  updated_at: string
}

// ===== 上传文件 =====
export interface UploadFile {
  id: number
  user_id: number
  original_filename: string
  filename: string
  file_path: string
  file_url: string
  file_size: number
  mime_type: string
  upload_type: 'app_icon' | 'avatar'
  status: number  // 1=正常, 0=已删除
  created_at: string
  updated_at: string
}

export interface UserFilesResponse {
  files: UploadFile[]
  pagination: {
    page: number
    limit: number
    total: number
    total_page: number
  }
}

// ===== 审计日志 =====
export interface AuditLog {
  id: number
  app_id?: number
  user_id: number
  action: string
  resource: string
  resource_id: number
  details: string
  ip_address: string
  user_agent: string
  created_at: string
}

// ===== 推送统计 =====
export interface PushStatistics {
  id: number
  app_id: number
  date: string
  total_pushes: number
  success_pushes: number
  failed_pushes: number
  click_count: number
  open_count: number
  created_at: string
  updated_at: string
}

// ===== 请求类型 =====
export interface PaginationParams {
  page?: number
  limit?: number
  page_size?: number
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  user: User
  token: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  nickname?: string
}

export interface UpdateProfileRequest {
  nickname?: string
  avatar?: string
}

export interface ChangePasswordRequest {
  old_password: string
  new_password: string
}

// ===== 推送请求 =====
export interface PushTarget {
  type: 'all' | 'devices' | 'tags' | 'groups'
  device_ids?: number[]
  tag_ids?: number[]      // 保留用于兼容
  group_ids?: number[]
  tags?: TagFilter[]      // 新的设备标签筛选
  platform?: string
  channel?: string
}

export interface TagFilter {
  tag_name: string
  tag_value?: string      // 可选，不提供则匹配所有值
}

export interface SendPushRequest {
  title: string
  content: string
  payload?: {
    action?: string
    url?: string
    data?: string
  }
  target: PushTarget
  schedule_time?: string
}

// ===== 筛选规则 =====
export interface FilterRule {
  field: string
  operator: 'equals' | 'contains' | 'in' | 'not_in' | 'is_null' | 'is_not_null'
  value: {
    string_value?: string
    string_values?: string[]
  }
}

// ===== 通用响应类型 =====
export interface APIResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PaginatedResponse<T = unknown> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}
