import { Subscription } from 'expo-modules-core';
import { DooPushModule } from './DooPushModule';
import type {
  DooPushConfig,
  DooPushVendor,
  DooPushMessage,
} from './types';
import type {
  OnRegisterEvent,
  OnRegisterErrorEvent,
} from './events';

/**
 * DooPush React Native SDK — imperative API
 *
 * v0.1.0 alpha — minimal surface: configure / register / token getters / event listeners
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
export function register(): Promise<{
  token: string;
  deviceId: string;
  vendor: DooPushVendor;
}> {
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
