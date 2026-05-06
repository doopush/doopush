import type { ConfigPlugin } from '@expo/config-plugins';
import type { PluginConfig } from '../schema';
import { withDooPushRootBuildGradle } from './withRootBuildGradle';
import { withDooPushAppBuildGradle } from './withAppBuildGradle';
import { withDooPushGoogleServices } from './withGoogleServices';

export const withAndroid: ConfigPlugin<PluginConfig> = (config, validated) => {
  config = withDooPushRootBuildGradle(config, validated);
  config = withDooPushAppBuildGradle(config, validated);
  config = withDooPushGoogleServices(config, validated);
  return config;
};
