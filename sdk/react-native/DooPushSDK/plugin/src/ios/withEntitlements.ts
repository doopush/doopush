import { ConfigPlugin, withEntitlementsPlist } from '@expo/config-plugins';
import type { PluginConfig } from '../schema';

/**
 * Sets aps-environment entitlement based on plugin's ios.mode.
 */
export const withDooPushEntitlements: ConfigPlugin<PluginConfig> = (config, validated) => {
  return withEntitlementsPlist(config, (cfg) => {
    cfg.modResults['aps-environment'] = validated.ios.mode;
    return cfg;
  });
};
