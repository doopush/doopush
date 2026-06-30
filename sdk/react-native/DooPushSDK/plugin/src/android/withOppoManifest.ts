import { AndroidConfig, ConfigPlugin, withAndroidManifest } from '@expo/config-plugins';
import type { PluginConfig } from '../schema';

/**
 * HeyTap MCS（OPPO/ColorOS 推送）要求在 AndroidManifest 声明的权限与回调 service。
 *
 * umeng `oppo-push` 的 aar 自带 manifest 为空（只声明 package），不会贡献这些节点；
 * 其余 vendor 的 aar 自带完整 manifest，所以只有 OPPO 需要 plugin 主动补。缺这些节点时，
 * 系统推送服务收到注册后无处回传 RegisterId，DooPush.register() 会静默超时、拿不到 token。
 */
const MCS_PERMISSIONS = [
  'com.coloros.mcs.permission.RECIEVE_MCS_MESSAGE',
  'com.heytap.mcs.permission.RECIEVE_MCS_MESSAGE',
];

const MCS_SERVICES: { name: string; permission: string; actions: string[] }[] = [
  {
    name: 'com.heytap.msp.push.service.CompatibleDataMessageCallbackService',
    permission: 'com.coloros.mcs.permission.SEND_MCS_MESSAGE',
    actions: ['com.coloros.mcs.action.RECEIVE_MCS_MESSAGE'],
  },
  {
    name: 'com.heytap.msp.push.service.DataMessageCallbackService',
    permission: 'com.heytap.mcs.permission.SEND_PUSH_MESSAGE',
    actions: [
      'com.heytap.mcs.action.RECEIVE_MCS_MESSAGE',
      'com.heytap.msp.push.RECEIVE_MCS_MESSAGE',
    ],
  },
];

export const withDooPushOppoManifest: ConfigPlugin<PluginConfig> = (config, validated) => {
  // service 类来自 oppo-push 依赖，仅在启用 OPPO vendor 时注入。
  if (!validated.android.vendors.oppo) {
    return config;
  }

  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.ensurePermissions(cfg.modResults, MCS_PERMISSIONS);

    const application = AndroidConfig.Manifest.getMainApplication(cfg.modResults);
    if (!application) return cfg;
    application.service = application.service ?? [];
    for (const svc of MCS_SERVICES) {
      const exists = application.service.some(
        (s) => s.$?.['android:name'] === svc.name
      );
      if (exists) continue;
      application.service.push({
        $: {
          'android:name': svc.name,
          'android:permission': svc.permission,
          'android:exported': 'true',
        },
        'intent-filter': [
          { action: svc.actions.map((a) => ({ $: { 'android:name': a } })) },
        ],
      });
    }

    return cfg;
  });
};
