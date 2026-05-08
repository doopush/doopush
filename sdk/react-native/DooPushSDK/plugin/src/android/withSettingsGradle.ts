import {
  ConfigPlugin,
  withSettingsGradle,
} from '@expo/config-plugins';
import type { PluginConfig } from '../schema';

function hasLibsVersionCatalog(contents: string): boolean {
  return /versionCatalogs\s*{[\s\S]*?\blibs\s*{/.test(contents)
    || /versionCatalogs\s*{[\s\S]*?create\(["']libs["']\)/.test(contents);
}

function addLibsVersionCatalog(contents: string): string {
  if (hasLibsVersionCatalog(contents)) return contents;

  const block = `\ndependencyResolutionManagement {\n  versionCatalogs {\n    libs {\n      from(files(new File(\n        providers.exec {\n          workingDir(rootDir)\n          commandLine("node", "--print", "require.resolve('react-native/package.json')")\n        }.standardOutput.asText.get().trim()\n      ).getParentFile().toPath().resolve("gradle/libs.versions.toml").toFile()))\n    }\n  }\n}\n`;

  const pluginsBlock = contents.match(/plugins\s*{[\s\S]*?\n}/);
  if (pluginsBlock?.index !== undefined) {
    const insertAt = pluginsBlock.index + pluginsBlock[0].length;
    return `${contents.slice(0, insertAt)}${block}${contents.slice(insertAt)}`;
  }

  return `${contents.trimEnd()}${block}\n`;
}

/**
 * Huawei AGC 1.9.x reads Android Gradle Plugin version from a version catalog
 * named `libs`. Expo SDK 54 creates `expoLibs`, so provide the RN catalog under
 * the conventional name as well when HMS is enabled.
 */
export const withDooPushSettingsGradle: ConfigPlugin<PluginConfig> = (config, validated) => {
  if (!validated.android.vendors.hms) return config;

  return withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = addLibsVersionCatalog(cfg.modResults.contents);
    return cfg;
  });
};
