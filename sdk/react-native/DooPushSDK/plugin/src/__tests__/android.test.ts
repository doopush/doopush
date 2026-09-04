import { withAndroid } from '../android/withAndroid';
import {
  DOOPUSH_ANDROID_SDK_COORDINATE,
  upsertDependency,
} from '../android/withAppBuildGradle';
import { removeLegacyMavenLocal } from '../android/withRootBuildGradle';
import { preferHostNotificationIcon } from '../android/withNotificationManifest';
import { ExpoConfig } from '@expo/config-types';

const baseConfig: ExpoConfig = {
  name: 'TestApp',
  slug: 'testapp',
  android: {
    package: 'com.test.app',
  },
};

describe('withAndroid', () => {
  test('registers project + app + dangerous mods when fcm enabled', () => {
    const result: any = withAndroid(structuredClone(baseConfig), {
      appId: 'a', appKey: 'dp_ak_test',
      ios: { mode: 'production' },
      android: {
        vendors: { fcm: { googleServicesFile: './google-services.json' } },
      },
    });
    expect(result.mods?.android).toBeDefined();
    // The mod compiler accumulates Gradle + file-copy mods.
    // We at least verify the registration shape exists.
    expect(typeof result.mods.android.gradleProperties).toBe('function');
    expect(typeof result.mods.android.projectBuildGradle).toBe('function');
    expect(typeof result.mods.android.appBuildGradle).toBe('function');
    expect(typeof result.mods.android.manifest).toBe('function');
    expect(typeof result.mods.android.dangerous).toBe('function');
  });

  test('does NOT register dangerous mod (file copy) when fcm omitted', () => {
    const result: any = withAndroid(structuredClone(baseConfig), {
      appId: 'a', appKey: 'dp_ak_test',
      ios: { mode: 'production' },
      android: { vendors: {} },
    });
    // projectBuildGradle and appBuildGradle still register (for placeholders + maven repos),
    // but dangerous (file copy) is skipped because no FCM file is provided.
    expect(result.mods?.android?.gradleProperties).toBeDefined();
    expect(result.mods?.android?.projectBuildGradle).toBeDefined();
    expect(result.mods?.android?.manifest).toBeDefined();
    expect(result.mods?.android?.dangerous).toBeUndefined();
  });
});

describe('preferHostNotificationIcon', () => {
  test('marks an existing host FCM icon as authoritative', () => {
    const manifest: any = {
      manifest: {
        $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
        application: [
          {
            $: { 'android:name': '.MainApplication' },
            'meta-data': [
              {
                $: {
                  'android:name': 'com.google.firebase.messaging.default_notification_icon',
                  'android:resource': '@drawable/notification_icon',
                },
              },
            ],
          },
        ],
      },
    };

    expect(preferHostNotificationIcon(manifest)).toBe(true);
    expect(manifest.manifest.$['xmlns:tools']).toBe(
      'http://schemas.android.com/tools'
    );
    expect(manifest.manifest.application[0]['meta-data'][0].$['tools:replace']).toBe(
      'android:resource'
    );
  });

  test('creates the Expo host icon metadata when the manifest mod runs first', () => {
    const manifest: any = {
      manifest: {
        $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
        application: [{ $: { 'android:name': '.MainApplication' } }],
      },
    };

    expect(preferHostNotificationIcon(manifest, true)).toBe(true);
    expect(manifest.manifest.application[0]['meta-data']).toContainEqual({
      $: {
        'android:name': 'com.google.firebase.messaging.default_notification_icon',
        'android:resource': '@drawable/notification_icon',
        'tools:replace': 'android:resource',
      },
    });
  });

  test('keeps the native SDK fallback when the host does not configure an icon', () => {
    const manifest: any = {
      manifest: {
        $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
        application: [{ $: { 'android:name': '.MainApplication' } }],
      },
    };

    expect(preferHostNotificationIcon(manifest)).toBe(false);
    expect(manifest.manifest.$['xmlns:tools']).toBeUndefined();
    expect(manifest.manifest.application[0]['meta-data']).toBeUndefined();
  });
});

describe('upsertDependency', () => {
  const dependency = `implementation '${DOOPUSH_ANDROID_SDK_COORDINATE}'`;

  test('upgrades an existing JitPack dependency', () => {
    const contents = `dependencies {
    implementation 'com.github.doopush:doopush-android-sdk:1.3.0'
}`;

    const result = upsertDependency(contents, dependency);

    expect(result).toContain(dependency);
    expect(result).not.toContain('com.github.doopush:doopush-android-sdk:1.3.0');
  });

  test('inserts the dependency when it is absent', () => {
    const result = upsertDependency('dependencies {\n}', dependency);

    expect(result).toContain(dependency);
  });

  test('does not duplicate the current dependency', () => {
    const contents = `dependencies {
    ${dependency}
}`;

    const result = upsertDependency(contents, dependency);

    expect(result.match(/com\.github\.doopush:doopush-android-sdk:1\.3\.4/g)).toHaveLength(1);
  });
});

describe('removeLegacyMavenLocal', () => {
  test('removes the old local repository without changing published repositories', () => {
    const contents = `allprojects {
  repositories {
    mavenLocal() // injected by an older DooPush plugin
    maven { url 'https://jitpack.io' }
    mavenCentral()
  }
}`;

    const result = removeLegacyMavenLocal(contents);

    expect(result).not.toContain('mavenLocal()');
    expect(result).toContain("maven { url 'https://jitpack.io' }");
    expect(result).toContain('mavenCentral()');
  });
});
