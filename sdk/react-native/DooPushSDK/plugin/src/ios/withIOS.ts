import type { ConfigPlugin } from '@expo/config-plugins';
import type { PluginConfig } from '../schema';
import { withDooPushInfoPlist } from './withInfoPlist';
import { withDooPushEntitlements } from './withEntitlements';
import { withDooPushPodfile } from './withPodfile';

export const withIOS: ConfigPlugin<PluginConfig> = (config, validated) => {
  config = withDooPushPodfile(config, validated);
  config = withDooPushInfoPlist(config, validated);
  config = withDooPushEntitlements(config, validated);
  return config;
};
