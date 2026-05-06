import { ConfigPlugin, withInfoPlist } from '@expo/config-plugins';
import type { PluginConfig } from '../schema';

/**
 * Adds `remote-notification` to Info.plist UIBackgroundModes (idempotent).
 */
export const withDooPushInfoPlist: ConfigPlugin<PluginConfig> = (config, _validated) => {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    const existing = (plist.UIBackgroundModes as string[] | undefined) ?? [];
    if (!existing.includes('remote-notification')) {
      plist.UIBackgroundModes = [...existing, 'remote-notification'];
    }
    return cfg;
  });
};
