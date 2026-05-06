import {
  ConfigPlugin,
  withProjectBuildGradle,
} from '@expo/config-plugins';
import type { PluginConfig } from '../schema';

/**
 * Adds Maven repositories (jitpack + mavenLocal during dev) to root build.gradle.
 * Idempotent.
 */
export const withDooPushRootBuildGradle: ConfigPlugin<PluginConfig> = (config, _validated) => {
  return withProjectBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // Add JitPack repo if missing.
    const jitpack = `maven { url 'https://jitpack.io' }`;
    if (!contents.includes('jitpack.io')) {
      contents = contents.replace(
        /allprojects\s*{\s*repositories\s*{/,
        `allprojects {\n    repositories {\n        ${jitpack}`
      );
    }

    // mavenLocal for development.
    if (!contents.includes('mavenLocal()')) {
      contents = contents.replace(
        /allprojects\s*{\s*repositories\s*{/,
        `allprojects {\n    repositories {\n        mavenLocal()`
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
