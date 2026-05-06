import type { DooPushVendor, DooPushMessage, DooPushError } from './types';

/**
 * Event names emitted by the native module.
 * v0.1.0 alpha: register / message events only.
 * v0.5.0 will add: gateway / click / present.
 */
export const EVENT_NAMES = [
  'onRegister',
  'onRegisterError',
  'onMessage',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export interface OnRegisterEvent {
  token: string;
  deviceId: string;
  vendor: DooPushVendor;
}

export interface OnRegisterErrorEvent {
  code: string;
  message: string;
}

// Map event name → payload type. Used by typed addListener helpers.
export interface EventPayloadMap {
  onRegister: OnRegisterEvent;
  onRegisterError: OnRegisterErrorEvent;
  onMessage: DooPushMessage;
}
