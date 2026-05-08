import { Subscription } from 'expo-modules-core';
import { DooPushModule } from './DooPushModule';
import type {
  DooPushConfig,
  DooPushVendor,
  DooPushMessage,
  DooPushNotificationManagementMode,
  DooPushGatewayOpenEvent,
  DooPushGatewayClosedEvent,
  DooPushGatewayErrorEvent,
  DooPushRegisterResult,
  DooPushDeviceInfo,
  DooPushPermissionStatus,
} from './types';
import type {
  OnRegisterEvent,
  OnRegisterErrorEvent,
} from './events';

/**
 * DooPush React Native SDK — imperative API
 *
 * v0.5.0 — registration, OEM channels, token/device getters, hooks,
 * notification events, WebSocket gateway, badge, statistics, and coexistence controls.
 */

/**
 * Configure the SDK. Call once per app launch, ideally in App entry point.
 * Idempotent — calling again replaces the prior config.
 */
export function configure(config: DooPushConfig): void {
  DooPushModule.configure(config);
}

/**
 * Register for push notifications. Triggers permission request (iOS) and
 * token retrieval, then registers the device with DooPush server.
 *
 * Returns the device token + DooPush deviceId on success.
 * Rejects if user denies permission or network fails.
 */
export function register(): Promise<DooPushRegisterResult> {
  return DooPushModule.register();
}

/**
 * Register with a token already obtained externally (e.g. via expo-notifications
 * `getDevicePushTokenAsync()`). Skips SDK's internal permission/token flow.
 */
export function registerWithToken(
  token: string,
  vendor: DooPushVendor = 'fcm'
): Promise<{ deviceId: string }> {
  return DooPushModule.registerWithToken(token, vendor);
}

/** Returns current device token (after register success), or null. */
export function getDeviceToken(): Promise<string | null> {
  return DooPushModule.getDeviceToken();
}

/** Returns DooPush server-assigned deviceId (after register success), or null. */
export function getDeviceId(): Promise<string | null> {
  return DooPushModule.getDeviceId();
}

/** Returns the current native SDK device information snapshot, or null before configure. */
export function getDeviceInfo(): Promise<DooPushDeviceInfo | null> {
  return DooPushModule.getDeviceInfo();
}

/** Refresh device information on the DooPush server using the current token. */
export function updateDeviceInfo(): Promise<void> {
  return DooPushModule.updateDeviceInfo();
}

/** Immediately flush locally collected push statistics. */
export function reportStatistics(): Promise<void> {
  return DooPushModule.reportStatistics();
}

/** Check OS-level push notification permission status. */
export function checkPermissionStatus(): Promise<DooPushPermissionStatus> {
  return DooPushModule.checkPermissionStatus();
}

/** Set the application badge count. */
export function setBadge(count: number): Promise<boolean> {
  return DooPushModule.setBadge(count);
}

/** Clear the application badge count. */
export function clearBadge(): Promise<boolean> {
  return DooPushModule.clearBadge();
}

/** Return the last known application badge count. */
export function getBadge(): Promise<number> {
  return DooPushModule.getBadge();
}

/**
 * Set notification management mode.
 *
 * - active: DooPush requests permission / owns notification handling where possible.
 * - passive: host app obtains token and calls registerWithToken().
 */
export function setNotificationManagementMode(
  mode: DooPushNotificationManagementMode
): void {
  DooPushModule.setNotificationManagementMode(mode);
}

/**
 * Android: relay FCM messages to Expo Notifications coexistence broadcast.
 * iOS: no-op because delegate forwarding is used.
 */
export function setExpoNotificationRelayEnabled(enabled: boolean): void {
  DooPushModule.setExpoNotificationRelayEnabled(enabled);
}

/**
 * Android: toggle SDK-owned FCM notification display.
 * iOS: no-op; use setNotificationManagementMode('passive') to disable DooPush delegate tracking.
 */
export function setNotificationDisplayEnabled(enabled: boolean): void {
  DooPushModule.setNotificationDisplayEnabled(enabled);
}

/** Manually connect the WebSocket gateway using the registered device token. */
export function connectGateway(): Promise<void> {
  return DooPushModule.connectGateway();
}

/** Manually disconnect the WebSocket gateway. */
export function disconnectGateway(): Promise<void> {
  return DooPushModule.disconnectGateway();
}

// ── Event subscriptions ──────────────────────────────────────────────────

export function addRegisterListener(
  listener: (e: OnRegisterEvent) => void
): Subscription {
  return DooPushModule.addListener('onRegister', listener);
}

export function addRegisterErrorListener(
  listener: (e: OnRegisterErrorEvent) => void
): Subscription {
  return DooPushModule.addListener('onRegisterError', listener);
}

export function addMessageListener(
  listener: (msg: DooPushMessage) => void
): Subscription {
  return DooPushModule.addListener('onMessage', listener);
}

export function addNotificationClickListener(
  listener: (msg: DooPushMessage) => void
): Subscription {
  return DooPushModule.addListener('onNotificationClick', listener);
}

export function addNotificationOpenListener(
  listener: (msg: DooPushMessage) => void
): Subscription {
  return DooPushModule.addListener('onNotificationOpen', listener);
}

export function addGatewayOpenListener(
  listener: (e: DooPushGatewayOpenEvent) => void
): Subscription {
  return DooPushModule.addListener('onGatewayOpen', listener);
}

export function addGatewayClosedListener(
  listener: (e: DooPushGatewayClosedEvent) => void
): Subscription {
  return DooPushModule.addListener('onGatewayClosed', listener);
}

export function addGatewayErrorListener(
  listener: (e: DooPushGatewayErrorEvent) => void
): Subscription {
  return DooPushModule.addListener('onGatewayError', listener);
}
