import { AndroidConfig, ConfigPlugin, withAndroidManifest } from '@expo/config-plugins';
import type { PluginConfig } from '../schema';

const FIREBASE_DEFAULT_NOTIFICATION_ICON =
  'com.google.firebase.messaging.default_notification_icon';
type AndroidManifest = Parameters<
  typeof AndroidConfig.Manifest.getMainApplication
>[0];

/**
 * DooPush's native Android SDK provides @drawable/ic_notification as a fallback
 * for apps that do not configure an FCM notification icon. When the host app
 * already declares its own icon (for example through expo-notifications), mark
 * the host value as authoritative so Android's manifest merger can override the
 * SDK fallback instead of failing on the two different resources.
 */
export function preferHostNotificationIcon(
  manifest: AndroidManifest,
  ensureExpoNotificationIcon = false
): boolean {
  const application = AndroidConfig.Manifest.getMainApplication(manifest);
  if (!application) {
    return false;
  }

  const metadata = application['meta-data'] ?? [];
  let defaultNotificationIcon = metadata.find(
    (entry) => entry.$?.['android:name'] === FIREBASE_DEFAULT_NOTIFICATION_ICON
  );

  // Android manifest mods execute in reverse registration order. When DooPush
  // is listed after expo-notifications, this mod may run before Expo creates its
  // metadata. If the host configured notification.icon, create the same entry
  // Expo will use so the merger override is present regardless of mod order.
  if (!defaultNotificationIcon && ensureExpoNotificationIcon) {
    defaultNotificationIcon = {
      $: {
        'android:name': FIREBASE_DEFAULT_NOTIFICATION_ICON,
        'android:resource': '@drawable/notification_icon',
      },
    };
    metadata.push(defaultNotificationIcon);
    application['meta-data'] = metadata;
  }

  if (!defaultNotificationIcon?.$?.['android:resource']) {
    return false;
  }

  AndroidConfig.Manifest.ensureToolsAvailable(manifest);
  (defaultNotificationIcon.$ as Record<string, string | undefined>)[
    'tools:replace'
  ] = 'android:resource';
  return true;
}

export const withDooPushNotificationManifest: ConfigPlugin<PluginConfig> = (
  config
) => {
  const hostConfiguresNotificationIcon = Boolean(config.notification?.icon);
  return withAndroidManifest(config, (cfg) => {
    preferHostNotificationIcon(
      cfg.modResults,
      hostConfiguresNotificationIcon
    );
    return cfg;
  });
};
