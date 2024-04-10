import { Config, DiscordConfig } from './types/Config.js';
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

/**
 * Collects all twitch channel names from all the Discord config sections and
 * return a list of them with or with out a preceding '#'
 * @param config
 * @param withHash
 * @returns string[]
 */
export function getAllChannels(config: Config, withHash = false): string[] {
  return config.discordConfigs.flatMap((discordConfig) => {
    return discordConfig.twitchChannels.map(
      (twitchChannel) => `${withHash ? '#' : ''}${twitchChannel}`,
    );
  });
}
