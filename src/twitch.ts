import { Chat } from 'twitch-js';
import logger from './logger.js';
import axios from './axios.js';
import { getAppToken } from './auth.js';
import { Config } from './config.js';
import { channel } from 'diagnostics_channel';

export default class Twitch {
  private clientSecret?: string;
  private appToken?: string;

  public clientId?: string;
  public channels: TwitchChannel[];

  // (twitch.tv\/.*\/clip) check https://www.twitch.tv/username/clip/clip_id
  // (clips.twitch.tv) checks https://clips.twitch.tv/clip_id
  public static clipsRegex = /(twitch.tv\/.*\/clip)|(clips.twitch.tv)\/[\w-]+/i;

  constructor(config: Config) {
    const { twitchClientId, twitchClientSecret } = config;
    this.clientId = twitchClientId;
    this.clientSecret = twitchClientSecret;

    this.channels = Twitch.getUsernamesFromConfig(config);
  }

  public static getClipUrlSlug(message: string): string {
    // split message by spaces, then filter out anything that's not a twitch clip
    const urls = message.split(' ').filter((messagePart) => {
      return Twitch.clipsRegex.test(messagePart);
    });
    logger.log('debug', `URLs FOUND: ${urls.length} urls: `, urls);
    if (urls.length < 1) {
      throw new Error(`no urls found in message: ${message}`);
    }

    const path = new URL(urls[0]).pathname;
    const clipId = path.split('/').pop();
    if (!path || !clipId) {
      logger.log('error', `MALFORMED URL: ${urls[0]}`);
      return '';
    }
    logger.log('debug', `CLIP SLUG: ${clipId}`);
    return clipId;
  }

  public static getUsernames(
    channels: TwitchChannel[],
    withHash = false,
  ): string[] {
    return channels.map((channel) => {
      return `${withHash ? '#' : ''}${channel.username}`;
    });
  }

  public async getClipInfo(clipId: string): Promise<ClipInfo> {
    if (!this.appToken || !this.clientId) return { id: clipId } as ClipInfo;
    const res = await this.apiGetCall('clips', clipId);
    logger.log('debug', 'Twitch clip results:', res);
    const clipInfo: TwitchClipInfo = {
      ...res,
      title: res.title.trim(),
    };
    if (!clipInfo.creator_id || !clipInfo.broadcaster_id || !clipInfo.game_id) {
      throw new Error('Failed to get required clip info from twitch');
    }

    const results = await Promise.all([
      this.apiGetCall('users', clipInfo.creator_id),
      this.apiGetCall('users', clipInfo.broadcaster_id),
      this.apiGetCall('games', clipInfo.game_id),
    ]);

    logger.log('debug', 'DEBUG: Async results:\n', results);
    return {
      userInfo: results[0] as TwitchUserInfo,
      broadcasterInfo: results[1] as TwitchBroadcasterInfo,
      gameInfo: results[2] as TwitchGameInfo,
      ...clipInfo,
    } as ClipInfo;
  }

  public async apiGetCall(endpoint: string, id: string): Promise<any> {
    const options = {
      url: `https://api.twitch.tv/helix/${endpoint}`,
      params: {
        id,
      },
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${this.appToken}`,
      },
    };
    logger.log('info', `GET: /${endpoint}?id=${id}`);
    try {
      const response = await axios.request(options);
      return response.data.data[0];
    } catch (err) {
      logger.log('error', `ERROR: GET twitch API /${endpoint}:`, err);
      console.error(`ERROR: GET twitch API /${endpoint}: ${err}`);
      return err;
    }
  }

  public async setAppToken(): Promise<boolean> {
    if (this.appToken) {
      return true;
    }
    // Application token, to be fetched async via getAppToken
    if (this.clientId && this.clientSecret) {
      this.appToken = await getAppToken(this.clientId, this.clientSecret);

      // A Twitch App Token, do a one-time lookup of twitch login names to IDs
      //   so we can restrict to only those channels if set in the Discord Config
      return true;
    }
    logger.log(
      'info',
      '\n***No Twitch Client ID and Client Secret provided - Cannot use advanced features like rich embeds***\n',
    );
    return false;
  }

  public static async createTwitchChatClient(twitch: Twitch): Promise<Chat> {
    const chat = new Chat({});
    await chat.connect();
    const allChannels = Twitch.getUsernames(twitch.channels, true);
    // TODO: if channel isn't a real channel this will never resolve
    await Promise.all(allChannels.map((channel) => chat.join(channel)));
    return chat;
  }

  private static getUsernamesFromConfig(config: Config): TwitchChannel[] {
    const arrayWithDuplicates = config.discordConfigs.flatMap(
      (discordConfig) => {
        return discordConfig.twitchChannels.map((twitchChannel) => {
          return {
            username: `${twitchChannel.toLowerCase()}`,
          } as TwitchChannel;
        });
      },
    );
    return [
      ...new Map(
        arrayWithDuplicates.map((item) => [item['username'], item]),
      ).values(),
    ];
  }

  public getChannelIds(channelNames?: string[]): string[] {
    let ids: string[] = [];
    if (channelNames) {
      channelNames.forEach((channelName) => {
        const channel = this.channels.find(
          (channel) => channel.username === channelName,
        );
        if (channel?.id) {
          ids.push(channel.id);
        }
      });
    } else {
      this.channels.forEach((channel) => {
        if (channel.id) {
          ids.push(channel.id);
        }
      });
    }

    return ids;
  }
  public async setChannelIds(): Promise<void> {
    if (this.channels[0]?.id) return;
    const usernameFuncs = this.channels.map(async ({ username }) => {
      const options = {
        url: `https://api.twitch.tv/helix/users`,
        params: {
          login: username,
        },
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${this.appToken}`,
        },
      };
      logger.log('info', `GET: /users?login=${username}`);
      let id = '';
      try {
        const response = await axios.request(options);
        id = response.data.data?.[0]?.id;
        if (!id) {
          logger.log(
            'error',
            `Username: ${username} did not return a Twitch ID. Did you spell the name right?`,
          );
        }
      } catch (err) {
        logger.log('error', `ERROR: GET twitch API /users:`, err);
      }
      return { username, id };
    });
    this.channels = await Promise.all(usernameFuncs).catch((err) => {
      logger.error(err);
      return this.channels;
    });
  }
}

type TwitchChannel = {
  username: string;
  id?: string;
};

export type TwitchUserInfo = {
  id: string;
  login: string;
  display_name: string;
  type?: string;
  broadcaster_type?: string;
  description?: string;
  profile_image_url?: string;
  offline_image_url?: string;
  view_count: number;
  created_at: string;
};

export type TwitchBroadcasterInfo = {
  id: string;
  login: string;
  display_name: string;
  type?: string;
  broadcaster_type?: string;
  description?: string;
  profile_image_url?: string;
  offline_image_url?: string;
  view_count: number;
  created_at: string;
};
export type TwitchGameInfo = {
  id: string;
  name: string;
  box_art_url: string;
  igdb_id?: string;
};

export type TwitchClipInfo = {
  id: string;
  url?: string;
  embed_url?: string;
  broadcaster_id?: string;
  broadcaster_name?: string;
  creator_id?: string;
  creator_name?: string;
  video_id?: string;
  game_id?: string;
  language?: string;
  title?: string;
  view_count?: number;
  created_at?: string;
  thumbnail_url?: string;
  duration?: number;
  vod_offset?: number;
  is_featured?: boolean;
};

export type ClipInfo = {
  gameInfo?: TwitchGameInfo;
  broadcasterInfo?: TwitchBroadcasterInfo;
  userInfo?: TwitchUserInfo;
} & TwitchClipInfo;
