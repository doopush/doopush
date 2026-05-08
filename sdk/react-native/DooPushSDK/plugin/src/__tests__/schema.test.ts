import { validatePluginConfig } from '../schema';

describe('validatePluginConfig', () => {
  test('accepts minimum valid config', () => {
    const result = validatePluginConfig({
      appId: 'app_123',
      apiKey: 'key_abc',
    });
    expect(result.appId).toBe('app_123');
    expect(result.apiKey).toBe('key_abc');
    expect(result.ios.mode).toBe('production'); // default
    expect(result.android.vendors).toEqual({});
  });

  test('accepts full config with fcm vendor', () => {
    const result = validatePluginConfig({
      appId: 'app_123',
      apiKey: 'key_abc',
      baseURL: 'https://test.doopush.com/api/v1',
      ios: { mode: 'development' },
      android: {
        vendors: {
          fcm: { googleServicesFile: './google-services.json' },
        },
      },
    });
    expect(result.android.vendors.fcm?.googleServicesFile).toBe(
      './google-services.json'
    );
  });

  test('accepts android OEM vendor config', () => {
    const result = validatePluginConfig({
      appId: 'app_123',
      apiKey: 'key_abc',
      android: {
        vendors: {
          hms: { agconnectServicesFile: './agconnect-services.json' },
          honor: {
            clientId: 'honor_client',
            clientSecret: 'honor_secret',
            appId: 'honor_app',
            developerId: 'dev_123',
          },
          xiaomi: { appId: 'mi_app', appKey: 'mi_key' },
          oppo: { appKey: 'oppo_key', appSecret: 'oppo_secret' },
          vivo: { appId: 'vivo_app', apiKey: 'vivo_key' },
          meizu: { appId: 'meizu_app', appKey: 'meizu_key' },
        },
      },
    });
    expect(result.android.vendors.honor?.appId).toBe('honor_app');
    expect(result.android.vendors.honor?.clientSecret).toBe('honor_secret');
    expect(result.android.vendors.xiaomi?.appKey).toBe('mi_key');
  });

  test('rejects missing appId', () => {
    expect(() => validatePluginConfig({ apiKey: 'k' })).toThrow(
      /appId is required/
    );
  });

  test('rejects missing apiKey', () => {
    expect(() => validatePluginConfig({ appId: 'a' })).toThrow(
      /apiKey is required/
    );
  });

  test('rejects fcm vendor without googleServicesFile', () => {
    expect(() =>
      validatePluginConfig({
        appId: 'a',
        apiKey: 'k',
        android: { vendors: { fcm: {} } },
      })
    ).toThrow(/googleServicesFile is required/);
  });

  test('rejects partial OEM vendor credentials', () => {
    expect(() =>
      validatePluginConfig({
        appId: 'a',
        apiKey: 'k',
        android: { vendors: { xiaomi: { appId: 'mi_app' } } },
      })
    ).toThrow(/xiaomi requires either servicesFile or appId \+ appKey/);
  });

  test('rejects hms vendor without services file', () => {
    expect(() =>
      validatePluginConfig({
        appId: 'a',
        apiKey: 'k',
        android: { vendors: { hms: {} } },
      })
    ).toThrow(/agconnectServicesFile is required/);
  });

  test('rejects invalid baseURL', () => {
    expect(() =>
      validatePluginConfig({ appId: 'a', apiKey: 'k', baseURL: 'not-a-url' })
    ).toThrow();
  });
});
