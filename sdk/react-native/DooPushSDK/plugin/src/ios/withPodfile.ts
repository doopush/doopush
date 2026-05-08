import fs from 'fs';
import path from 'path';
import { ConfigPlugin, withDangerousMod } from '@expo/config-plugins';
import type { PluginConfig } from '../schema';

const LOCAL_IOS_SDK_RELATIVE_PATH = '../../../ios/DooPushSDK';
const LOCAL_IOS_SDK_POD_LINE = `  pod 'DooPushSDK', :path => '${LOCAL_IOS_SDK_RELATIVE_PATH}'`;

function addLocalDooPushSDKPod(contents: string): string {
  if (contents.includes("pod 'DooPushSDK'") || contents.includes('pod "DooPushSDK"')) {
    return contents;
  }

  const targetStart = contents.match(/target\s+['"][^'"]+['"]\s+do\s*\n/);
  if (targetStart?.index === undefined) {
    return contents;
  }

  const useExpoModules = contents.indexOf('  use_expo_modules!', targetStart.index);
  if (useExpoModules !== -1) {
    const lineEnd = contents.indexOf('\n', useExpoModules);
    return `${contents.slice(0, lineEnd + 1)}${LOCAL_IOS_SDK_POD_LINE}\n${contents.slice(lineEnd + 1)}`;
  }

  const insertAt = targetStart.index + targetStart[0].length;
  return `${contents.slice(0, insertAt)}${LOCAL_IOS_SDK_POD_LINE}\n${contents.slice(insertAt)}`;
}

/**
 * During monorepo development the native iOS SDK lives at sdk/ios/DooPushSDK,
 * while the RN podspec declares `DooPushSDK` as a normal CocoaPods dependency.
 * Point the generated example Podfile at the local pod when it exists.
 */
export const withDooPushPodfile: ConfigPlugin<PluginConfig> = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
    const localPodspec = path.resolve(
      cfg.modRequest.projectRoot,
      LOCAL_IOS_SDK_RELATIVE_PATH,
      'DooPushSDK.podspec'
    );

    if (!fs.existsSync(localPodspec)) {
      return cfg;
    }

    const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
    const contents = await fs.promises.readFile(podfilePath, 'utf8');
    await fs.promises.writeFile(podfilePath, addLocalDooPushSDKPod(contents));
    return cfg;
    },
  ]);
};
