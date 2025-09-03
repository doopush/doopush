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
  badge?: number
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

// ===== 统一分页请求/响应 =====
export interface SortField {
  key: string
  desc: boolean
}

export interface PaginationRequest<F extends Record<string, unknown> = Record<string, unknown>> {
  page?: number
  page_size?: number
  sorts?: SortField[]
  filters?: F
}

export interface PaginationEnvelope<TData> {
  current_page: number
  page_size: number
  total_items: number
  total_pages: number
  data: {
    items: TData[]
    // 这里可按需扩展：额外统计字段等
  }
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
  user_name?: string        // 新增: 用户名冗余字段
  action: string
  resource: string
  resource_id: number
  details: string
  before_data?: string | null      // 新增: 变更前数据JSON
  after_data?: string | null       // 新增: 变更后数据JSON
  ip_address: string
  user_agent: string
  created_at: string
  // 关联数据
  app?: App
  user?: User
}

// 审计日志DTO（包含友好标签）
export interface AuditLogDTO extends AuditLog {
  app_name?: string         // 应用名称
  action_label?: string     // 操作类型友好标签
  resource_label?: string   // 资源类型友好标签
}

// 审计日志筛选条件
export interface AuditFilters {
  user_id?: number
  action?: string
  resource?: string
  start_time?: string       // ISO 8601 格式时间
  end_time?: string
  ip_address?: string
  user_name?: string
  app_id?: number
}

// 操作统计
export interface OperationStat {
  action: string
  resource: string
  count: number
  action_label?: string     // 操作类型友好标签
  resource_label?: string   // 资源类型友好标签
}

// 用户活动统计
export interface UserActivityStat {
  user_id: number
  user_name: string
  action_count: number
  last_activity: string
}

// 统计接口响应封装
export interface OperationStatisticsResponse {
  statistics: OperationStat[]
  period: {
    days: number
    app_id: number
    app_name?: string | null
  }
}

export interface UserActivityStatisticsResponse {
  user_activity: UserActivityStat[]
  period: {
    days: number
    limit: number
    app_id: number
  }
}

// 审计日志列表响应
export interface AuditLogListResponse {
  logs: AuditLogDTO[]
  total: number
  page: number
  page_size: number
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

// ===== 认证与通用响应 =====
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

export interface APIResponse<T = unknown> {
  code: number
  message: string
  data: T
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
  badge?: number
  payload?: {
    action?: string
    url?: string
    data?: string
  }
  target: PushTarget
  schedule_time?: string
}

export interface ScheduledPush {
  id: number
  app_id: number
  name: string
  title: string
  content: string
  payload?: string
  badge?: number
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
