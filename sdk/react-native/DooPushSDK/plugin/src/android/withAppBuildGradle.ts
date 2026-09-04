import {
  ConfigPlugin,
  withAppBuildGradle,
} from '@expo/config-plugins';
import type { PluginConfig } from '../schema';
import * as fs from 'fs';
import * as path from 'path';

function q(value: string | undefined): string {
  return `"${(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * When the Honor vendor uses file mode (mcsServicesFile) without inline appId/developerId,
 * read them from the file so the DOOPUSH_HONOR_APP_ID / DOOPUSH_HONOR_DEVELOPER_ID
 * manifest placeholders are populated. The Honor push SDK requires these meta-data entries
 * at runtime; empty values → error 3607 "missing AppId".
 */
function resolveHonorInline(projectRoot: string, vendor: NonNullable<PluginConfig['android']['vendors']['honor']>): void {
  if (!vendor.mcsServicesFile || (vendor.appId && vendor.developerId)) return;
  try {
    const abs = path.isAbsolute(vendor.mcsServicesFile)
      ? vendor.mcsServicesFile
      : path.resolve(projectRoot, vendor.mcsServicesFile);
    if (!fs.existsSync(abs)) return;
    const mcs = JSON.parse(fs.readFileSync(abs, 'utf8'));
    if (!vendor.appId && mcs.app_id) vendor.appId = String(mcs.app_id);
    if (!vendor.developerId && mcs.developer_id) vendor.developerId = String(mcs.developer_id);
  } catch { /* file may not exist yet during config evaluation — skip gracefully */ }
}

function addApplyPlugin(contents: string, pluginId: string): string {
  const line = `apply plugin: '${pluginId}'`;
  if (contents.includes(line) || contents.includes(`id '${pluginId}'`) || contents.includes(`id("${pluginId}")`)) {
    return contents;
  }
  return `${contents.trimEnd()}\n${line}\n`;
}

function addDependency(contents: string, dependency: string): string {
  const artifact = dependency.match(/'([^:]+:[^:]+):/)?.[1] ?? dependency;
  if (contents.includes(artifact)) return contents;
  return contents.replace(/dependencies\s*{/, `dependencies {\n    ${dependency}`);
}

export const DOOPUSH_ANDROID_SDK_COORDINATE =
  'com.github.doopush:doopush-android-sdk:1.3.2';

export function upsertDependency(contents: string, dependency: string): string {
  const coordinate = dependency.match(/['"]([^'"]+)['"]/)?.[1];
  const artifact = coordinate?.match(/^(.+):[^:]+$/)?.[1];
  if (!coordinate || !artifact) return addDependency(contents, dependency);

  const escapedArtifact = artifact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingCoordinate = new RegExp(`(['"])${escapedArtifact}:[^'"]+\\1`);
  if (existingCoordinate.test(contents)) {
    return contents.replace(existingCoordinate, (_match, quote: string) => `${quote}${coordinate}${quote}`);
  }

  return addDependency(contents, dependency);
}

function mergeManifestPlaceholders(
  contents: string,
  placeholderValues: Record<string, string | undefined>
): string {
  const entries = Object.entries(placeholderValues)
    .map(([key, value]) => `${key}: ${q(value)}`);

  if (entries.length === 0) return contents;

  const doopushMap = entries.join(', ');
  const doopushLine = `manifestPlaceholders += [${doopushMap}]`;

  // Idempotency: if all DooPush keys already exist somewhere, do not inject again.
  if (entries.every((entry) => contents.includes(entry.split(':')[0]))) {
    return contents;
  }

  const defaultConfigMatch = contents.match(/defaultConfig\s*{/);
  if (!defaultConfigMatch || defaultConfigMatch.index === undefined) {
    return contents;
  }

  const insertAt = defaultConfigMatch.index + defaultConfigMatch[0].length;
  return `${contents.slice(0, insertAt)}\n        ${doopushLine}${contents.slice(insertAt)}`;
}

export const withDooPushAppBuildGradle: ConfigPlugin<PluginConfig> = (config, validated) => {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    const v = validated.android.vendors;

    // Honor file mode: if appId/developerId aren't provided inline, resolve them from
    // mcs-services.json so manifest placeholders are populated at build time.
    if (v.honor) {
      const projectRoot = (cfg as any).modRequest?.projectRoot || process.cwd();
      resolveHonorInline(projectRoot, v.honor);
    }

    // 1. Apply vendor Gradle plugins where required by the upstream SDKs.
    if (v.fcm) contents = addApplyPlugin(contents, 'com.google.gms.google-services');
    if (v.hms) contents = addApplyPlugin(contents, 'com.huawei.agconnect');
    if (v.honor) contents = addApplyPlugin(contents, 'com.hihonor.mcs.asplugin');

    // 2. Merge DooPush manifest placeholders into defaultConfig, even if the host
    // project or another plugin already defines manifestPlaceholders.
    contents = mergeManifestPlaceholders(contents, {
      DOOPUSH_MI_APP_ID: v.xiaomi?.appId,
      DOOPUSH_MI_APP_KEY: v.xiaomi?.appKey,
      DOOPUSH_OPPO_APP_KEY: v.oppo?.appKey,
      DOOPUSH_OPPO_APP_SECRET: v.oppo?.appSecret,
      DOOPUSH_VIVO_APP_ID: v.vivo?.appId,
      DOOPUSH_VIVO_API_KEY: v.vivo?.apiKey,
      DOOPUSH_MEIZU_APP_ID: v.meizu?.appId,
      DOOPUSH_MEIZU_APP_KEY: v.meizu?.appKey,
      DOOPUSH_HONOR_APP_ID: v.honor?.appId,
      DOOPUSH_HONOR_DEVELOPER_ID: v.honor?.developerId,
    });

    // 3. Inject DooPush Android SDK dependency if not present.
    contents = upsertDependency(
      contents,
      `implementation '${DOOPUSH_ANDROID_SDK_COORDINATE}'`
    );

    const vendorDependencies: Array<[boolean, string]> = [
      [!!v.hms, "implementation 'com.huawei.hms:push:6.11.0.300'"],
      [!!v.honor, "implementation 'com.hihonor.mcs:push:8.0.12.307'"],
      [!!v.xiaomi, "implementation 'com.umeng.umsdk:xiaomi-push:6.0.1'"],
      [!!v.oppo, "implementation 'com.umeng.umsdk:oppo-push:3.5.3'"],
      [!!v.vivo, "implementation 'com.umeng.umsdk:vivo-push:4.0.6.0'"],
      [!!v.meizu, "implementation 'com.umeng.umsdk:meizu-push:5.0.3'"],
    ];
    for (const [enabled, dependency] of vendorDependencies) {
      if (enabled) contents = addDependency(contents, dependency);
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
