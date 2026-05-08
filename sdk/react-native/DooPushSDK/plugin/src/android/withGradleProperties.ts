import {
  ConfigPlugin,
  withGradleProperties,
} from '@expo/config-plugins';
import type { PluginConfig } from '../schema';

const MIN_SDK_KEY = 'android.minSdkVersion';
const DOOPUSH_MIN_SDK = 26;

export const withDooPushGradleProperties: ConfigPlugin<PluginConfig> = (config) => {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const existing = props.find((item) => item.type === 'property' && item.key === MIN_SDK_KEY);

    if (existing?.type === 'property') {
      const parsed = Number.parseInt(existing.value, 10);
      if (!Number.isNaN(parsed) && parsed >= DOOPUSH_MIN_SDK) return cfg;
      existing.value = String(DOOPUSH_MIN_SDK);
      return cfg;
    }

    props.push({
      type: 'property',
      key: MIN_SDK_KEY,
      value: String(DOOPUSH_MIN_SDK),
    });
    return cfg;
  });
};
