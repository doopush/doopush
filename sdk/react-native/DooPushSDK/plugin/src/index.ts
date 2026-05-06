import { ConfigPlugin } from '@expo/config-plugins';
import { validatePluginConfig, PluginConfig } from './schema';
import { withIOS } from './ios/withIOS';
import { withAndroid } from './android/withAndroid';

const withDooPush: ConfigPlugin<unknown> = (config, raw) => {
  const validated: PluginConfig = validatePluginConfig(raw);
  config = withIOS(config, validated);
  config = withAndroid(config, validated);
  return config;
};

export default withDooPush;
