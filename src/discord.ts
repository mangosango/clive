import axios from './axios.js';
import { Config, DiscordConfig } from './config.js';
import logger from './logger.js';
import { ClipInfo, TwitchGameInfo, TwitchUserInfo } from './twitch.js';

export type DiscordMessage = { content: string };

export type RichEmbedMessage = {
  content: string;
  embeds: {
    title: ClipInfo['title'];
    url: ClipInfo['url'];
    color: number;
    timestamp: ClipInfo['created_at'];
    thumbnail?: {
      url: TwitchGameInfo['box_art_url'];
    };
    author: {
      name: TwitchUserInfo['display_name'];
      url: string;
      icon_url: TwitchUserInfo['profile_image_url'];
    };
    fields: {
      name: string;
      value: string;
      inline: boolean;
    }[];
  }[];
};

export default class Discord {
  public configs: DiscordConfig[];

  constructor(config: Config) {
    this.configs = config.discordConfigs;
  }

  public static async postMessage(
    discordConfig: DiscordConfig,
    content: DiscordMessage,
    clipInfo: ClipInfo,
  ): Promise<boolean> {
    type DiscordBotInfo = {
      username?: string;
      avatar_url?: string;
    };

    const data: DiscordMessage & DiscordBotInfo = {
      ...content,
      username: discordConfig.botUsername,
      avatar_url: discordConfig.botAvatarURL,
    };
    const options = {
      method: 'POST',
      url: discordConfig.webhookURL,
      data,
    };

    // Post single, simple message to Discord
    if (!discordConfig.useRichEmbed || !clipInfo.url || !clipInfo.title) {
      const response = await axios.request(options);
      if (response.status === 204) {
        return true;
      }
      return false;
    }

    // Post message with rich embed content to Discord
    const initialMessage = {
      method: options.method,
      url: options.url,
      data: {
        content: `[${clipInfo.title}](${clipInfo.url})`,
      },
    };
    logger.log('debug', 'POST: 1 of 2 requests with options', initialMessage);
    // ensure order of the posts, nest the promises
    let response = await axios.request(initialMessage);
    if (response.status === 204) {
      logger.log('debug', 'POST: 2 of 2 requests with body', options);
      response = await axios.request(options);
      if (response.status === 204) {
        return true;
      }
      return false;
    }
    return false;
  }

  public static buildMessage(
    clipInfo: ClipInfo,
    useRichEmbed = false,
    displayName?: string,
  ): DiscordMessage {
    const { broadcasterInfo, gameInfo, userInfo } = clipInfo;
    if (!broadcasterInfo || !gameInfo || !userInfo) {
      const clipUrl = `https://clips.twitch.tv/${clipInfo.id}`;
      const content = {
        content: `**${displayName}** posted a clip: ${clipUrl}`,
      };
      return content;
    }

    if (!useRichEmbed) {
      let playingStr = '';
      // underscores, and asterisks on the next two lines are Discord markdown formatting
      if (gameInfo) playingStr = ` playing __${gameInfo.name}__`;
      const string = `[${clipInfo.title}](${clipInfo.url})\n\n*${userInfo.display_name}* created a clip of *${broadcasterInfo.display_name}*${playingStr}`;
      return { content: string };
    }

    const richEmbedMessage: RichEmbedMessage = {
      content: '',
      embeds: [
        {
          title: clipInfo.title,
          url: clipInfo.url,
          color: 9442302,
          timestamp: clipInfo.created_at,
          author: {
            name: userInfo.display_name,
            url: `https://www.twitch.tv/${userInfo.login}`,
            icon_url: userInfo.profile_image_url,
          },
          fields: [
            {
              name: 'Channel',
              value: `[${broadcasterInfo.display_name}](https://www.twitch.tv/${broadcasterInfo.login})`,
              inline: true,
            },
          ],
        },
      ],
    };

    // Enhance embed message with game info
    if (gameInfo?.box_art_url) {
      richEmbedMessage.embeds[0].thumbnail = {
        url: gameInfo.box_art_url
          .replace('{height}', '80')
          .replace('{width}', '80'),
      };
    }
    if (gameInfo?.name) {
      richEmbedMessage.embeds[0].fields.push({
        name: 'Game',
        value: gameInfo.name || '',
        inline: true,
      });
    }
    return richEmbedMessage;
  }
}
