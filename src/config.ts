import { LoggerOptions } from 'winston';
import data from '../config/config.json' with { type: 'json' };

// merge down any global settings to each DiscordConfig
const discordConfigs: DiscordConfig[] = data.discordConfigs.map(
  (discordConfig) => {
    const permissions = (discordConfig as any)?.permissions ||
      (data as any)?.permissions || {
        listedChannelsOnly: true,
        allowEveryone: true,
      };
    const useRichEmbed =
      (discordConfig as any)?.useRichEmbed ||
      (data as any)?.useRichEmbed ||
      false;
    const botUsername =
      (discordConfig as any)?.botUsername ||
      (data as any)?.botUserName ||
      'Clive';
    const botAvatarURL =
      (discordConfig as any)?.botAvatarURL ||
      (data as any)?.botAvatarURL ||
      'http://i.imgur.com/9s3TBNv.png';

    return {
      ...discordConfig,
      permissions,
      useRichEmbed,
      botUsername,
      botAvatarURL,
    } as DiscordConfig;
  },
);

// merge the updated discordConfigs back into the user's config object
const config: Config = {
  ...data,
  discordConfigs,
};

// default values for required settings
const defaultConfig: Config = {
  logLevel: 'error',
  logFile: './config/clive.log',
  dbFile: './config/db.json',
  discordConfigs: [],
};

// merge defaults with user's config object
export default {
  ...defaultConfig,
  ...config,
} as Config;

export type PermissionsConfig = {
  listedChannelsOnly?: boolean;
  allowEveryone: boolean;
  allowFollowers?: boolean;
  allowVIPs?: boolean;
  allowSubs?: boolean;
  allowMods?: boolean;
  allowBroadcaster?: boolean;
};

type OverridableConfigs = {
  permissions: PermissionsConfig;
  useRichEmbed: boolean;
  botUsername: string;
  botAvatarURL: string;
};

export type DiscordConfig = {
  webhookURL: string;
  twitchChannels: string[];
} & OverridableConfigs;

type ConfigBase = {
  logLevel?: LoggerOptions['level'];
  logFile: string;
  dbFile: string;
  twitchClientId?: string;
  twitchClientSecret?: string;
  discordConfigs: DiscordConfig[];
};
export type Config = ConfigBase | (ConfigBase & OverridableConfigs);
