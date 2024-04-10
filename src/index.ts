import Axios from 'axios';
import { setupCache } from 'axios-cache-interceptor/dev';
import { URL } from 'node:url';
import { JSONFilePreset } from 'lowdb/node';
import { DiscordMessage, RichEmbedMessage } from './types/DiscordMessage.js';
import { Database } from './types/Database.js';
import { getAppToken } from './auth.js';
import {
  BroadcasterInfo,
  GameInfo,
  UserInfo,
  ClipInfo,
} from './types/Twitch.js';
import {
  Chat,
  Commands,
  PrivateMessages,
  TagCommands,
  UserStateTags,
} from 'twitch-js';

const instance = Axios.create();
const axios = setupCache(instance, {
  debug: console.log,
});

//Initialize constants
import config, { getAllChannels } from './config.js';
import logger from './logger.js';
import { Config, DiscordConfig } from './types/Config.js';

const { twitchClientId, twitchClientSecret } = config;

// (twitch.tv\/.*\/clip) check https://www.twitch.tv/username/clip/clip_id
// (clips.twitch.tv) checks https://clips.twitch.tv/clip_id
const CLIPS_REGEX = /(twitch.tv\/.*\/clip)|(clips.twitch.tv)\/[\w-]+/i;

let TWITCH_CHANNEL_IDS: string[] = [];
let APP_TOKEN: string | null;
// Application token, to be fetched async via getAppToken
if (twitchClientId && twitchClientSecret) {
  APP_TOKEN = await getAppToken(twitchClientId, twitchClientSecret);
} else {
  logger.log(
    'error',
    '\n***No Twitch Client ID and Client Secret provided - Cannot use advanced features like rich embeds***\n',
  );
}

const defaultData: Database = { postedClips: [] };
const DB = await JSONFilePreset<Database>(config.dbFile, defaultData);

main();
async function main(): Promise<void> {
  // A Twitch App Token, do a one-time lookup of twitch login names to IDs
  //   so we can restrict to only those channels if set in the Discord Config
  if (APP_TOKEN) {
    const allChannels = getAllChannels(config);
    TWITCH_CHANNEL_IDS = await resolveTwitchUsernamesToIds(allChannels);
  }
  logStartInfo();
  const chat = await createTwitchChatClient();
  createChatListeners(chat);
}

function logStartInfo(): void {
  const redactedConfig = structuredClone(config);
  delete redactedConfig.twitchClientSecret;
  logger.log('debug', 'CONFIG SETTINGS:\n', {
    ...redactedConfig,
  });
  logger.log('debug', `Twitch App Token IS ${APP_TOKEN ? '' : 'NOT '}set`);
}

async function createTwitchChatClient(): Promise<Chat> {
  const chat = new Chat({});
  const connectedChat = await chat.connect();
  const allChannels = getAllChannels(config, true);
  await Promise.all(allChannels.map((channel) => chat.join(channel)));
  return chat;
}

function createChatListeners(chat: Chat) {
  // Listen to private messages
  chat.on('PRIVMSG', (message) => {
    logger.log(
      'debug',
      `${JSON.stringify(message)}\n\ttest: ${CLIPS_REGEX.test(message.message)}`,
    );

    console.log(
      `jdflkajsdlfajdlfjasdfjsalkdjflasjd ${JSON.stringify(message)}\n\ttest: ${CLIPS_REGEX.test(message.message)}`,
    );

    const self = message.isSelf;

    // Don't listen to my own messages..
    if (self) return;
    const discordChannels = getPermittedDiscordConfigs(message, config);

    // Handle different message types..
    switch (message.event) {
      case Commands.PRIVATE_MESSAGE:
        discordChannels.forEach((discordChannel) => {
          handlePrivateMessage(discordChannel, message);
        });
        break;
      default:
        // Something else ?
        break;
    }
  });
}

function handlePrivateMessage(
  discordChannel: DiscordConfig,
  message: PrivateMessages,
): void {
  const messageString = message.message;
  if (!CLIPS_REGEX.test(messageString)) {
    return;
  }
  logger.log('debug', `CLIP DETECTED: in message: ${messageString}`);
  const clipId = getUrlSlug(messageString);
  // check if its this clip has already been posted
  const posted = checkDbForClip(clipId, discordChannel.webhookURL);
  if (posted) {
    logger.log(
      'info',
      `PREVIOUSLY POSTED CLIP: ${clipId} was posted on ${new Date(
        posted.date,
      )} to Discord webhook: ${discordChannel.webhookURL}`,
    );
    return;
  }
  // If we have a client ID we can use the Twitch API
  if (APP_TOKEN) {
    postUsingTwitchAPI(clipId, discordChannel);
  } else {
    // Fallback to dumb method of posting
    const displayName = message.tags.displayName;
    postUsingMessageInfo({ discordChannel, clipId, displayName });
  }
}

function getPermittedDiscordConfigs(
  message: PrivateMessages,
  config: Config,
): DiscordConfig[] {
  return config.discordConfigs.reduce((permittedConfigs, discordConfig) => {
    const { twitchChannels, permissions } = discordConfig;
    const user = message.username;

    // Filter all messages for the correct Discord channels
    // Bot can be connected to multiple channels at once and messages come
    //   from all connected channels but may not map to all Discords
    const isWatchedChannel = twitchChannels.some((twitchChannel) => {
      return twitchChannel.toLowerCase() === message.channel.toLowerCase();
    });
    if (!isWatchedChannel) {
      return permittedConfigs;
    }

    const tags = message.tags as UserStateTags;
    // const isFollower
    // const isVIP = tags.badges?.vip == '1'
    // const isTurbo = tags.turbo == '1';
    const isSub = tags.subscriber == '1';
    const isMod = tags.isModerator;
    const isBroadcaster = tags.badges.broadcaster == '1';

    // skip other checks if everyone is allowed
    if (permissions.allowEveryone) {
      return [...permittedConfigs, discordConfig];
    }

    // if (permissions.allowFollowers && isFollower) {
    //   return [...permittedConfigs, discordConfig];
    // }

    // if (permissions.allowVIPs && isVIP) {
    //   return [...permittedConfigs, discordConfig];
    // }

    if (permissions.allowSubs && isSub) {
      return [...permittedConfigs, discordConfig];
    }

    if (permissions.allowMods && isMod) {
      return [...permittedConfigs, discordConfig];
    }

    if (permissions.allowBroadcaster && isBroadcaster) {
      return [...permittedConfigs, discordConfig];
    }

    logger.log(
      'info',
      `No permissions for user: ${user} sharing clip: ${message.message}\n\t
        Using permission set: ${permissions}`,
    );
    return permittedConfigs;
  }, [] as DiscordConfig[]);
}

function postUsingTwitchAPI(
  clipId: string,
  discordChannel: DiscordConfig,
): void {
  twitchApiGetCall('clips', clipId)
    .then((res) => {
      logger.log('debug', 'Twitch clip results:', res);
      const clipInfo: ClipInfo = {
        ...res,
        title: res.title.trim(),
      };

      if (
        discordChannel.permissions?.listedChannelsOnly &&
        TWITCH_CHANNEL_IDS.indexOf(clipInfo.broadcaster_id) === -1
      ) {
        logger.log(
          'info',
          'OUTSIDER CLIP: Posted in chat from tracked channel',
        );
        return;
      }

      Promise.all([
        twitchApiGetCall('users', clipInfo.creator_id),
        twitchApiGetCall('users', clipInfo.broadcaster_id),
        twitchApiGetCall('games', clipInfo.game_id),
      ])
        .then((results) => {
          logger.log('debug', 'DEBUG: Async results:\n', results);
          const content = buildMessage({
            userInfo: results[0] as UserInfo,
            broadcasterInfo: results[1] as BroadcasterInfo,
            gameInfo: results[2] as GameInfo,
            clipInfo,
            useRichEmbed: discordChannel.useRichEmbed,
          });
          logger.log('debug', 'DEBUG: generated rich embed', content);
          postToDiscord({ discordChannel, content, clipId, clipInfo });
        })
        .catch((err) => {
          console.error(err);
        });
    })
    .catch((err) => {
      logger.log('error', `ERROR: GET twitch API:`, err);
    });
}

function postUsingMessageInfo({
  clipId,
  displayName,
  discordChannel,
}: {
  clipId: string;
  displayName: string;
  discordChannel: DiscordConfig;
}): void {
  const clipUrl = `https://clips.twitch.tv/${clipId}`;
  const content = { content: `**${displayName}** posted a clip: ${clipUrl}` };
  postToDiscord({ discordChannel, content, clipId });
}

function getUrlSlug(message: string): string {
  // split message by spaces, then filter out anything that's not a twitch clip
  const urls = message.split(' ').filter((messagePart) => {
    return CLIPS_REGEX.test(messagePart);
  });
  logger.log('debug', `URLs FOUND: ${urls.length} urls: `, urls);
  if (urls.length < 1) {
    logger.log('error', 'ERROR: no urls found in message', message);
    return '';
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

function checkDbForClip(clipId: string, discordWebhook: string) {
  const { postedClips } = DB.data;
  const clip = postedClips.find((postedClip) => postedClip.id === clipId);
  const foundClip = clip?.discordWebhooks.find(
    ({ url }) => url == discordWebhook,
  );
  return foundClip;
}

function insertClipIdToDb(clipId: string, webhookURL: string): Promise<void> {
  if (!clipId) {
    logger.log('error', 'No clipId was passed when inserting to database!');
    return new Promise((resolve) => resolve());
  }

  const { postedClips } = DB.data;
  let clipIndex = postedClips.findIndex(
    (postedClip) => postedClip.id === clipId,
  );
  if (!clipIndex) {
    return DB.update(({ postedClips }) =>
      postedClips.push({
        id: clipId,
        discordWebhooks: [{ url: webhookURL, date: Date.now() }],
      }),
    );
  }

  return DB.update(({ postedClips }) => {
    postedClips[clipIndex].discordWebhooks.push({
      url: webhookURL,
      date: Date.now(),
    });
    return postedClips;
  });
}

async function twitchApiGetCall(endpoint: string, id: string): Promise<any> {
  if (!APP_TOKEN) return;
  const options = {
    url: `https://api.twitch.tv/helix/${endpoint}`,
    params: {
      id,
    },
    headers: {
      'Client-ID': twitchClientId,
      Authorization: `Bearer ${APP_TOKEN}`,
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

async function resolveTwitchUsernamesToIds(
  usernames: string[],
): Promise<string[]> {
  if (!APP_TOKEN) return [];

  const usernameFuncs = usernames.map(async (login) => {
    const options = {
      url: `https://api.twitch.tv/helix/users`,
      params: {
        login,
      },
      headers: {
        'Client-ID': twitchClientId,
        Authorization: `Bearer ${APP_TOKEN}`,
      },
    };
    logger.log('info', `GET: /users?login=${login}`);
    let id = '';
    try {
      const response = await axios.request(options);
      id = response.data.data?.[0]?.id;
      if (!id) {
        logger.log(
          'error',
          `Username: ${login} did not return a Twitch ID. Did you spell the name right?`,
        );
      }
    } catch (err) {
      logger.log('error', `ERROR: GET twitch API /users:`, err);
    }
    return id;
  });
  return await Promise.all(usernameFuncs)
    .then((userIds) => userIds.filter(Boolean))
    .catch((err) => {
      logger.error(err);
      return [];
    });
}

function postToDiscord({
  discordChannel,
  content,
  clipId,
  clipInfo,
}: {
  discordChannel: DiscordConfig;
  content: DiscordMessage;
  clipId: string;
  clipInfo?: ClipInfo;
}): void {
  type DiscordBotInfo = {
    username?: string;
    avatar_url?: string;
  };

  const data: DiscordMessage & DiscordBotInfo = {
    ...content,
    username: discordChannel.botUsername,
    avatar_url: discordChannel.botAvatarURL,
  };
  const options = {
    method: 'POST',
    url: discordChannel.webhookURL,
    data,
  };

  // Post single, simple message to Discord
  if (!discordChannel.useRichEmbed || !clipInfo) {
    axios
      .request(options)
      .then((response) => {
        if (response.status === 204) {
          insertClipIdToDb(clipId, discordChannel.webhookURL);
        }
      })
      .catch((err) => {
        logger.log('error', 'ERROR: posting to Discord', err);
      });
    return;
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
  axios
    .request(initialMessage)
    .then((response) => {
      if (response.status === 204) {
        logger.log('debug', 'POST: 2 of 2 requests with body', options);
        axios
          .request(options)
          .then((response) => {
            if (response.status === 204) {
              insertClipIdToDb(clipId, discordChannel.webhookURL);
            }
          })
          .catch((err) => {
            logger.log('error', 'ERROR: posting to Discord', err);
          });
      }
    })
    .catch((err) => {
      logger.log('error', 'ERROR: posting to Discord', err);
    });
}

function buildMessage({
  userInfo,
  broadcasterInfo,
  gameInfo,
  clipInfo,
  useRichEmbed = false,
}: {
  userInfo: UserInfo;
  broadcasterInfo: BroadcasterInfo;
  gameInfo: GameInfo;
  clipInfo: ClipInfo;
  useRichEmbed: Boolean;
}): DiscordMessage {
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
