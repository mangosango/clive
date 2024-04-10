import { LoggerOptions } from 'winston';

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
