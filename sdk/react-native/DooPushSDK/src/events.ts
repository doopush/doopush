import type {
  DooPushVendor,
  DooPushMessage,
  DooPushGatewayOpenEvent,
  DooPushGatewayClosedEvent,
  DooPushGatewayErrorEvent,
} from './types';

/**
 * Event names emitted by the native module.
 */
export const EVENT_NAMES = [
  'onRegister',
  'onRegisterError',
  'onMessage',
  'onNotificationClick',
  'onNotificationOpen',
  'onGatewayOpen',
  'onGatewayClosed',
  'onGatewayError',
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
  onNotificationClick: DooPushMessage;
  onNotificationOpen: DooPushMessage;
  onGatewayOpen: DooPushGatewayOpenEvent;
  onGatewayClosed: DooPushGatewayClosedEvent;
  onGatewayError: DooPushGatewayErrorEvent;
}
