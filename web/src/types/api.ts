// 推送平台 API 类型定义

import type { AndroidMessageCategory } from '@/lib/constants'

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

// ===== 推送配置相关 =====
// iOS推送配置
export interface IOSPushConfig {
  environment: 'development' | 'production'
  // P8密钥配置（推荐）
  key_id?: string
  team_id?: string
  bundle_id?: string
  private_key?: string  // P8私钥内容
  // P12证书配置（传统方式）
  cert_pem?: string     // P12证书PEM格式
  key_pem?: string      // P12私钥PEM格式
}

// Android推送基础配置
export interface AndroidPushBaseConfig {
  app_id?: string
  app_key?: string
  app_secret?: string
  client_id?: string
  client_secret?: string
}

// FCM推送配置
export interface FCMPushConfig {
  service_account_key: string  // Firebase服务账号密钥JSON
}

// 华为推送配置
export interface HuaweiPushConfig extends AndroidPushBaseConfig {
  app_id: string
  app_secret: string
}

// 小米推送配置
export interface XiaomiPushConfig extends AndroidPushBaseConfig {
  app_id: string
  app_key: string
  app_secret: string
}

// OPPO推送配置
export interface OppoPushConfig extends AndroidPushBaseConfig {
  app_id: string
  app_key: string
  app_secret: string
}

// VIVO推送配置
export interface VivoPushConfig extends AndroidPushBaseConfig {
  app_id: string
  app_key: string
  app_secret: string
}

// 魅族推送配置
export interface MeizuPushConfig extends AndroidPushBaseConfig {
  app_id: string
  app_secret: string
}

// 荣耀推送配置
export interface HonorPushConfig extends AndroidPushBaseConfig {
  app_id: string
  client_id: string
  client_secret: string
}

// 推送配置联合类型
export type PushConfig = 
  | IOSPushConfig 
  | FCMPushConfig 
  | HuaweiPushConfig 
  | XiaomiPushConfig 
  | OppoPushConfig 
  | VivoPushConfig 
  | MeizuPushConfig 
  | HonorPushConfig

// 推送厂商特有参数
export interface HuaweiPushParams {
  urgency?: 'HIGH' | 'NORMAL'
  category?: string
  ttl?: number
}

export interface XiaomiPushParams {
  channel_id?: string
  pass_through?: 0 | 1
  notify_type?: number
  time_to_live?: number
}

export interface OppoPushParams {
  // OPPO推送新消息分类系统（官方支持的2个参数）
  category?: AndroidMessageCategory
  notify_level?: 1 | 2 | 16          // 1=通知栏 2=通知栏+锁屏 16=通知栏+锁屏+横幅+震动+铃声
}

export interface VivoPushParams {
  category?: AndroidMessageCategory    // 消息分类，参考 vivo 分类说明
}

export interface MeizuPushParams {
  // 通知栏信息
  notice_msg_type?: 0 | 1                    // 消息分类：0=公信消息, 1=私信消息
  notice_bar_type?: 0 | 2                    // 通知栏样式：0=标准, 2=原生
  
  // 展开信息
  notice_expand_type?: 0 | 1 | 2             // 展开方式：0=标准, 1=文本, 2=大图
  notice_expand_content?: string             // 展开内容
  notice_expand_img_url?: string             // 展开大图URL
  
  // 点击行为
  click_type?: 0 | 1 | 2                     // 点击动作：0=打开应用, 1=打开页面, 2=打开URI
  activity?: string                          // 目标Activity
  url?: string                               // 目标URL
  parameters?: Record<string, unknown>       // 额外参数
  custom_attribute?: string                  // 自定义属性
  
  // 推送时间信息
  off_line?: 0 | 1                           // 离线消息：0=否, 1=是
  valid_time?: number                        // 有效时长(小时)：1-72
  
  // 高级信息
  suspend?: 0 | 1                            // 悬浮窗：0=不显示, 1=显示
  clear_notice_bar?: 0 | 1                   // 可清除：0=不可以, 1=可以
  notify_key?: string                        // 分组合并key
  vibrate?: 0 | 1                           // 震动：0=关闭, 1=开启
  lights?: 0 | 1                            // 闪光：0=关闭, 1=开启
  sound?: 0 | 1                             // 声音：0=关闭, 1=开启
  
  // VIP功能
  subtitle?: string                          // 子标题
  pull_down_top?: 0 | 1                     // 即时置顶：0=否, 1=是
  time_top?: number                          // 定时置顶(秒)：1800-7200
  not_group?: 0 | 1                         // 独立成组：0=否, 1=是
  title_color?: string                       // 标题颜色
  background_img_url?: string                // 背景图URL
  small_icon_url?: string                    // 小图标URL
  big_icon_url?: string                      // 大图标URL
  
  // 回执信息
  callback?: string                          // 回执地址
  callback_param?: string                    // 回执参数
  callback_type?: '1' | '2' | '3'           // 回执类型：1=送达, 2=点击, 3=送达+点击
}

export interface HonorPushParams {
  importance?: 'NORMAL' | 'HIGH'       // 消息重要性：NORMAL=服务通讯类, HIGH=紧急消息
  ttl?: string                         // 消息存活时间（如："86400s"）
  target_user_type?: 0 | 1            // 目标用户类型：0=正式消息, 1=测试消息
}
