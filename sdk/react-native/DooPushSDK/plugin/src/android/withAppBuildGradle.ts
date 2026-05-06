import {
  ConfigPlugin,
  withAppBuildGradle,
} from '@expo/config-plugins';
import type { PluginConfig } from '../schema';

const VENDOR_PLACEHOLDER_KEYS = [
  'DOOPUSH_MI_APP_ID',
  'DOOPUSH_MI_APP_KEY',
  'DOOPUSH_OPPO_APP_KEY',
  'DOOPUSH_OPPO_APP_SECRET',
  'DOOPUSH_VIVO_APP_ID',
  'DOOPUSH_VIVO_API_KEY',
  'DOOPUSH_MEIZU_APP_ID',
  'DOOPUSH_MEIZU_APP_KEY',
  'DOOPUSH_HONOR_APP_ID',
  'DOOPUSH_HONOR_DEVELOPER_ID',
];

export const withDooPushAppBuildGradle: ConfigPlugin<PluginConfig> = (config, validated) => {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // 1. Apply google-services plugin if FCM enabled
    if (validated.android.vendors.fcm) {
      if (!contents.includes("apply plugin: 'com.google.gms.google-services'")) {
        contents += `\napply plugin: 'com.google.gms.google-services'\n`;
      }
    }

    // 2. Inject manifestPlaceholders block (defaultConfig).
    //    For v0.1 alpha, all OEM vendors get empty string placeholders.
    const placeholders = VENDOR_PLACEHOLDER_KEYS
      .map((k) => `        ${k}: ""`)
      .join(',\n');

    const placeholderBlock = `manifestPlaceholders = [\n${placeholders}\n    ]`;

    if (!contents.includes('manifestPlaceholders')) {
      contents = contents.replace(
        /defaultConfig\s*{/,
        `defaultConfig {\n    ${placeholderBlock}`
      );
    }

    // 3. Inject DooPush Android SDK dependency if not present
    if (!contents.includes('com.github.doopush:doopush-android-sdk')) {
      contents = contents.replace(
        /dependencies\s*{/,
        `dependencies {\n    implementation 'com.github.doopush:doopush-android-sdk:1.1.+'`
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
