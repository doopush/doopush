import {
  ConfigPlugin,
  withDangerousMod,
} from '@expo/config-plugins';
import type { PluginConfig } from '../schema';
import * as fs from 'fs';
import * as path from 'path';

export const withDooPushGoogleServices: ConfigPlugin<PluginConfig> = (config, validated) => {
  if (!validated.android.vendors.fcm) {
    return config;  // No FCM vendor → no file to copy
  }
  const sourcePath = validated.android.vendors.fcm.googleServicesFile;

  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const absSource = path.isAbsolute(sourcePath)
        ? sourcePath
        : path.resolve(projectRoot, sourcePath);

      if (!fs.existsSync(absSource)) {
        throw new Error(
          `[doopush-react-native-sdk] google-services.json not found at: ${absSource}`
        );
      }

      const destDir = path.join(cfg.modRequest.platformProjectRoot, 'app');
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, 'google-services.json');
      fs.copyFileSync(absSource, dest);

      return cfg;
    },
  ]);
};
