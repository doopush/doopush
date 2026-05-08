import { useCallback, useEffect, useState } from 'react';
import * as DooPush from './DooPush';
import type {
  DooPushMessage,
  DooPushRegisterResult,
  DooPushVendor,
  DooPushError,
  DooPushPermissionStatus,
} from './types';

export interface UseDooPushState {
  token: string | null;
  deviceId: string | null;
  vendor: DooPushVendor | null;
  permissionStatus: DooPushPermissionStatus | null;
  lastMessage: DooPushMessage | null;
  lastNotificationClick: DooPushMessage | null;
  lastNotificationOpen: DooPushMessage | null;
  error: DooPushError | null;
  isRegistering: boolean;
  refresh: () => Promise<void>;
  register: () => Promise<DooPushRegisterResult>;
  registerWithToken: (token: string, vendor?: DooPushVendor) => Promise<{ deviceId: string }>;
}

/**
 * React hook for the common DooPush state lifecycle: token/deviceId snapshots,
 * registration actions, permission status, messages, notification opens/clicks,
 * and registration errors.
 */
export function useDooPush(): UseDooPushState {
  const [token, setToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [vendor, setVendor] = useState<DooPushVendor | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<DooPushPermissionStatus | null>(null);
  const [lastMessage, setLastMessage] = useState<DooPushMessage | null>(null);
  const [lastNotificationClick, setLastNotificationClick] = useState<DooPushMessage | null>(null);
  const [lastNotificationOpen, setLastNotificationOpen] = useState<DooPushMessage | null>(null);
  const [error, setError] = useState<DooPushError | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const refresh = useCallback(async () => {
    const [nextToken, nextDeviceId, nextPermissionStatus] = await Promise.all([
      DooPush.getDeviceToken(),
      DooPush.getDeviceId(),
      DooPush.checkPermissionStatus().catch(() => 'unknown' as const),
    ]);
    setToken(nextToken);
    setDeviceId(nextDeviceId);
    setPermissionStatus(nextPermissionStatus);
  }, []);

  const register = useCallback(async () => {
    setIsRegistering(true);
    setError(null);
    try {
      const result = await DooPush.register();
      setToken(result.token);
      setDeviceId(result.deviceId);
      setVendor(result.vendor);
      return result;
    } catch (e) {
      const normalized = normalizeError(e);
      setError(normalized);
      throw e;
    } finally {
      setIsRegistering(false);
    }
  }, []);

  const registerWithToken = useCallback(async (externalToken: string, nextVendor: DooPushVendor = 'fcm') => {
    setIsRegistering(true);
    setError(null);
    try {
      const result = await DooPush.registerWithToken(externalToken, nextVendor);
      setToken(externalToken);
      setDeviceId(result.deviceId);
      setVendor(nextVendor);
      return result;
    } catch (e) {
      const normalized = normalizeError(e);
      setError(normalized);
      throw e;
    } finally {
      setIsRegistering(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(normalizeError(e)));

    const subscriptions = [
      DooPush.addRegisterListener((event) => {
        setToken(event.token);
        setDeviceId(event.deviceId);
        setVendor(event.vendor);
        setError(null);
      }),
      DooPush.addRegisterErrorListener((event) => setError(event)),
      DooPush.addMessageListener(setLastMessage),
      DooPush.addNotificationClickListener(setLastNotificationClick),
      DooPush.addNotificationOpenListener(setLastNotificationOpen),
    ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [refresh]);

  return {
    token,
    deviceId,
    vendor,
    permissionStatus,
    lastMessage,
    lastNotificationClick,
    lastNotificationOpen,
    error,
    isRegistering,
    refresh,
    register,
    registerWithToken,
  };
}

/** Subscribe to push message/open/click events and keep a small in-memory list. */
export function useDooPushMessage(options: { maxMessages?: number } = {}) {
  const maxMessages = options.maxMessages ?? 50;
  const [messages, setMessages] = useState<DooPushMessage[]>([]);
  const [lastMessage, setLastMessage] = useState<DooPushMessage | null>(null);
  const [lastNotificationClick, setLastNotificationClick] = useState<DooPushMessage | null>(null);
  const [lastNotificationOpen, setLastNotificationOpen] = useState<DooPushMessage | null>(null);

  useEffect(() => {
    const appendMessage = (message: DooPushMessage) => {
      setLastMessage(message);
      setMessages((current) => [message, ...current].slice(0, maxMessages));
    };

    const subscriptions = [
      DooPush.addMessageListener(appendMessage),
      DooPush.addNotificationClickListener(setLastNotificationClick),
      DooPush.addNotificationOpenListener(setLastNotificationOpen),
    ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [maxMessages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastMessage(null);
  }, []);

  return {
    messages,
    lastMessage,
    lastNotificationClick,
    lastNotificationOpen,
    clearMessages,
  };
}

function normalizeError(error: unknown): DooPushError {
  if (error && typeof error === 'object') {
    const maybe = error as { code?: unknown; message?: unknown };
    return {
      code: typeof maybe.code === 'string' ? maybe.code : 'E_UNKNOWN',
      message: typeof maybe.message === 'string' ? maybe.message : String(error),
    };
  }
  return { code: 'E_UNKNOWN', message: String(error) };
}
