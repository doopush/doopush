import {
  ConfigPlugin,
  withDangerousMod,
} from '@expo/config-plugins';
import type { PluginConfig } from '../schema';
import * as fs from 'fs';
import * as path from 'path';

type CopyJob = { source: string; destRelative: string; label: string };
type WriteJob = { contents: Record<string, string>; destRelative: string; label: string };

function addCopy(jobs: CopyJob[], source: string | undefined, destRelative: string, label: string) {
  if (source) jobs.push({ source, destRelative, label });
}

function addWrite(jobs: WriteJob[], contents: Record<string, string | undefined>, destRelative: string, label: string) {
  const filtered = Object.fromEntries(
    Object.entries(contents).filter(([, value]) => value !== undefined && value !== '')
  ) as Record<string, string>;
  if (Object.keys(filtered).length > 0) jobs.push({ contents: filtered, destRelative, label });
}

export const withDooPushGoogleServices: ConfigPlugin<PluginConfig> = (config, validated) => {
  const vendors = validated.android.vendors;
  const copyJobs: CopyJob[] = [];
  const writeJobs: WriteJob[] = [];

  addCopy(copyJobs, vendors.fcm?.googleServicesFile, 'google-services.json', 'google-services.json');

  if (vendors.hms?.agconnectServicesFile) {
    addCopy(copyJobs, vendors.hms.agconnectServicesFile, 'agconnect-services.json', 'agconnect-services.json');
    addCopy(copyJobs, vendors.hms.agconnectServicesFile, path.join('src', 'main', 'assets', 'agconnect-services.json'), 'agconnect-services.json');
  }

  if (vendors.honor?.mcsServicesFile) {
    addCopy(copyJobs, vendors.honor.mcsServicesFile, 'mcs-services.json', 'mcs-services.json');
    addCopy(copyJobs, vendors.honor.mcsServicesFile, path.join('src', 'main', 'assets', 'mcs-services.json'), 'mcs-services.json');
  } else if (vendors.honor) {
    const honorJson = {
      client_id: vendors.honor.clientId,
      client_secret: vendors.honor.clientSecret,
      app_id: vendors.honor.appId,
      developer_id: vendors.honor.developerId,
    };
    addWrite(writeJobs, honorJson, 'mcs-services.json', 'mcs-services.json');
    addWrite(writeJobs, honorJson, path.join('src', 'main', 'assets', 'mcs-services.json'), 'mcs-services.json');
  }

  if (vendors.xiaomi?.servicesFile) {
    addCopy(copyJobs, vendors.xiaomi.servicesFile, path.join('src', 'main', 'assets', 'xiaomi-services.json'), 'xiaomi-services.json');
  } else if (vendors.xiaomi) {
    addWrite(writeJobs, { app_id: vendors.xiaomi.appId, app_key: vendors.xiaomi.appKey }, path.join('src', 'main', 'assets', 'xiaomi-services.json'), 'xiaomi-services.json');
  }

  if (vendors.oppo?.servicesFile) {
    addCopy(copyJobs, vendors.oppo.servicesFile, path.join('src', 'main', 'assets', 'oppo-services.json'), 'oppo-services.json');
  } else if (vendors.oppo) {
    addWrite(writeJobs, { app_key: vendors.oppo.appKey, app_secret: vendors.oppo.appSecret }, path.join('src', 'main', 'assets', 'oppo-services.json'), 'oppo-services.json');
  }

  if (vendors.vivo?.servicesFile) {
    addCopy(copyJobs, vendors.vivo.servicesFile, path.join('src', 'main', 'assets', 'vivo-services.json'), 'vivo-services.json');
  } else if (vendors.vivo) {
    addWrite(writeJobs, { app_id: vendors.vivo.appId, api_key: vendors.vivo.apiKey }, path.join('src', 'main', 'assets', 'vivo-services.json'), 'vivo-services.json');
  }

  if (vendors.meizu?.servicesFile) {
    addCopy(copyJobs, vendors.meizu.servicesFile, path.join('src', 'main', 'assets', 'meizu-services.json'), 'meizu-services.json');
  } else if (vendors.meizu) {
    addWrite(writeJobs, { app_id: vendors.meizu.appId, app_key: vendors.meizu.appKey }, path.join('src', 'main', 'assets', 'meizu-services.json'), 'meizu-services.json');
  }

  if (copyJobs.length === 0 && writeJobs.length === 0) {
    return config;
  }

  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const appDir = path.join(cfg.modRequest.platformProjectRoot, 'app');

      for (const job of copyJobs) {
        const absSource = path.isAbsolute(job.source)
          ? job.source
          : path.resolve(projectRoot, job.source);

        if (!fs.existsSync(absSource)) {
          throw new Error(
            `[doopush-react-native-sdk] ${job.label} not found at: ${absSource}`
          );
        }

        const dest = path.join(appDir, job.destRelative);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(absSource, dest);
      }

      for (const job of writeJobs) {
        const dest = path.join(appDir, job.destRelative);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, `${JSON.stringify(job.contents, null, 2)}\n`);
      }

      return cfg;
    },
  ]);
};
