/**
 * Vendor channel identifier — must match server-side device.channel field.
 */
export type DooPushVendor =
  | 'apns'
  | 'fcm'
  | 'hms'
  | 'honor'
  | 'xiaomi'
  | 'oppo'
  | 'vivo'
  | 'meizu';

export type DooPushLogLevel = 'debug' | 'info' | 'warning' | 'error' | 'off';

export type DooPushNotificationManagementMode = 'active' | 'passive';

export type DooPushPermissionStatus =
  | 'authorized'
  | 'denied'
  | 'notDetermined'
  | 'provisional'
  | 'ephemeral'
  | 'unknown';

export interface DooPushConfig {
  /** DooPush platform appId (assigned by server) */
  appId: string;
  /** DooPush platform apiKey (assigned by server) */
  apiKey: string;
  /** API base URL. Defaults to https://doopush.com/api/v1 if omitted. */
  baseURL?: string;
  /** Log level for native SDK side. */
  log?: DooPushLogLevel;
}

export interface DooPushRegisterResult {
  token: string;
  deviceId: string;
  vendor: DooPushVendor;
}

export interface DooPushDeviceInfo {
  platform: 'ios' | 'android' | string;
  channel: DooPushVendor | string;
  bundleId: string;
  brand: string;
  model: string;
  systemVersion: string;
  appVersion: string;
  userAgent: string;
}

/**
 * Push message payload as observed at the JS layer.
 * Fields are union-of-best-effort across iOS APNs and Android FCM/OEM.
 */
export interface DooPushMessage {
  /** Vendor that delivered this message */
  vendor?: DooPushVendor;
  /** Notification title (if push has notification block) */
  title?: string;
  /** Notification body */
  body?: string;
  /** Server-side push log id (if present in payload) */
  pushLogId?: string;
  /** Server-side dedup key (if present) */
  dedupKey?: string;
  /** Vendor-specific message id (FCM messageId / APNs apns-id / etc.) */
  messageId?: string;
  /** Original full data payload as a flat string-keyed map */
  data: Record<string, string>;
}

/**
 * Errors surfaced to JS from native bridge.
 * `code` matches the native DooPushError integer code stringified, plus human-readable form.
 */
export interface DooPushError {
  code: string;
  message: string;
  vendor?: DooPushVendor;
}

export interface DooPushGatewayOpenEvent {
  connected: true;
}

export interface DooPushGatewayClosedEvent {
  code: number;
  reason?: string;
}

export interface DooPushGatewayErrorEvent {
  code: string;
  message: string;
}
