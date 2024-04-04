import 'dotenv/config';
import axios from 'axios';
import { URL } from 'node:url';
import { JSONFilePreset } from 'lowdb/node';
// Init Twitch-JS
import { Chat, UserStateTags } from 'twitch-js';
const chat = new Chat({
  log: { level: 'silent' },
});
import { getAppToken } from './auth.js';
import {
  BroadcasterInfo,
  GameInfo,
  UserInfo,
  ClipInfo,
} from './types/Twitch.js';

//Initialize constants
import config from './config.js';
import logger from './logger.js';
import { DiscordMessage, RichEmbedMessage } from './types/DiscordMessage.js';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const {
  BOT_USERNAME,
  BROADCASTER_ONLY,
  DB_FILE,
  DISCORD_WEBHOOK_URL,
  MODS_ONLY,
  RESTRICT_CHANNELS,
  RICH_EMBED,
  SUBS_ONLY,
  TWITCH_CHANNELS,
  URL_AVATAR,
} = config;

// (twitch.tv\/.*\/clip) check https://www.twitch.tv/username/clip/clip_id
// (clips.twitch.tv) checks https://clips.twitch.tv/clip_id
const CLIPS_REGEX = /(twitch.tv\/.*\/clip)|(clips.twitch.tv)\/[\w-]+/i;

main();
async function main() {
  // Application token, to be fetched async via getAppToken
  var APP_TOKEN = await getAppToken();
  // If we have a twitch client ID and you want to restrict postings of clips to
  // only those channels Clive is watching
  // Do a one-time lookup of twitch login names to IDs
  let TWITCH_CHANNEL_IDS: string[] = [];
  if (APP_TOKEN && RESTRICT_CHANNELS) {
    resolveTwitchUsernamesToIds(TWITCH_CHANNELS)
      .then((userIds) => {
        TWITCH_CHANNEL_IDS = userIds;
        logStartInfo();
      })
      .catch((err) => {
        logger.error(err);
      });
  } else {
    logStartInfo();
  }

  type Data = {
    postedClipIds: {
      id: string;
      date: number;
    }[];
  };
  const defaultData: Data = { postedClipIds: [] };
  const db = await JSONFilePreset<Data>(DB_FILE, defaultData);

  function logStartInfo() {
    logger.log('info', 'CONFIG SETTINGS:\n', {
      DISCORD_WEBHOOK_URL,
      DB_FILE,
      TWITCH_CHANNELS,
      TWITCH_CHANNEL_IDS,
      RESTRICT_CHANNELS,
      BROADCASTER_ONLY,
      MODS_ONLY,
      SUBS_ONLY,
    });
    logger.log('info', `Twitch App Token is ${APP_TOKEN ? '' : 'NOT '}set`);

    createTwitchClient();
  }

  function createTwitchClient() {
    chat
      .connect()
      .then(() => {
        Promise.all(TWITCH_CHANNELS.map((channel) => chat.join(channel)))
          .then(() => {
            // Listen to private messages
            chat.on('PRIVMSG', (message) => {
              logger.log('info', {
                message,
                test: CLIPS_REGEX.test(message.message),
              });

              const self = message.isSelf;
              const tags = message.tags as UserStateTags;
              const isBroadcaster = tags.badges.broadcaster == '1';
              const isMod = tags.mod == '1';
              const isSub = tags.subscriber == '1';
              const chatMessage = message.message;

              // Don't listen to my own messages..
              if (self) return;
              // Broadcaster only mode
              if (BROADCASTER_ONLY && !isBroadcaster) {
                logger.log(
                  'info',
                  `NON-BROADCASTER posted a clip: ${chatMessage}`,
                );
                return;
              }
              // Mods only mode
              if (MODS_ONLY && !(isMod || isBroadcaster)) {
                logger.log('info', `NON-MOD posted a clip: ${chatMessage}`);
                return;
              }
              // Subs only mode
              if (SUBS_ONLY && !isSub) {
                logger.log('info', `NON-SUB posted a clip: ${chatMessage}`);
                return;
              }

              // Handle different message types..
              switch (message.event) {
                case 'PRIVMSG':
                  if (CLIPS_REGEX.test(chatMessage)) {
                    logger.log(
                      'debug',
                      `CLIP DETECTED: in message: ${chatMessage}`,
                    );
                    const clipId = getUrlSlug(chatMessage);
                    // check if its this clip has already been shared
                    const postedClip = checkDbForClip(clipId);
                    if (postedClip) {
                      logger.log(
                        'info',
                        `PREVIOUSLY SHARED CLIP: ${clipId} was pushed to Discord on ${new Date(
                          postedClip.date,
                        )}`,
                      );
                      return;
                    }
                    // If we have a client ID we can use the Twitch API
                    if (APP_TOKEN) {
                      postUsingTwitchAPI(clipId);
                    } else {
                      // Fallback to dumb method of posting
                      const displayName = message.tags.displayName;
                      postUsingMessageInfo({ clipId, displayName });
                    }
                  }
                  break;
                default:
                  // Something else ?
                  break;
              }
            });
          })
          .catch((err) => {
            logger.error(err);
          });
      })
      .catch((err) => {
        logger.error(err);
      });
  }

  function postUsingTwitchAPI(clipId: string) {
    twitchApiGetCall('clips', clipId)
      .then((res) => {
        logger.log('debug', 'Twitch clip results:', res);
        const clipInfo: ClipInfo = {
          ...res,
          title: res.title.trim(),
        };

        if (
          RESTRICT_CHANNELS &&
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
            });
            logger.log('debug', 'DEBUG: generated rich embed', content);
            postToDiscord({ content, clipId, clipInfo });
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
  }: {
    clipId: string;
    displayName: string;
  }) {
    const clipUrl = `https://clips.twitch.tv/${clipId}`;
    const content = { content: `**${displayName}** posted a clip: ${clipUrl}` };
    postToDiscord({ content, clipId });
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

  function checkDbForClip(clipId: string) {
    const { postedClipIds } = db.data;
    return postedClipIds.find((postedClip) => postedClip.id === clipId);
  }

  function insertClipIdToDb(clipId: string) {
    db.update(({ postedClipIds }) =>
      postedClipIds.push({ id: clipId, date: Date.now() }),
    );
  }

  async function twitchApiGetCall(endpoint: string, id: string) {
    if (!APP_TOKEN) return;
    const options = {
      url: `https://api.twitch.tv/helix/${endpoint}`,
      params: {
        id,
      },
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
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

    const usernameFuncs = usernames.map(async (username) => {
      const options = {
        url: `https://api.twitch.tv/helix/users`,
        params: {
          login: username.replace('#', ''),
        },
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          Authorization: `Bearer ${APP_TOKEN}`,
        },
      };
      logger.log('info', `GET: /users?login=${username}`);
      try {
        const response = await axios.request(options);
        const id = response.data.data?.[0]?.id;
        if (!id) {
          logger.log(
            'error',
            `Username: ${username} did not return a Twitch ID. Did you spell the name right?`,
          );
          const index = TWITCH_CHANNELS.indexOf(username);
          if (index > -1) {
            // only splice array when item is found
            TWITCH_CHANNELS.splice(index, 1); // 2nd parameter means remove one item only
          }
        }
        return id;
      } catch (err) {
        logger.log('error', `ERROR: GET twitch API /users:`, err);
        return err;
      }
    });
    return await Promise.all(usernameFuncs)
      .then((userIds) => userIds.filter(Boolean))
      .catch((err) => {
        logger.error(err);
        return [];
      });
  }

  function postToDiscord({
    content,
    clipId,
    clipInfo,
  }: {
    content: DiscordMessage;
    clipId: string;
    clipInfo?: ClipInfo;
  }) {
    // type Body =
    //   | (DiscordMessage & {
    //       username?: string;
    //       avatar_url?: string;
    //     })
    //   | ({ content: string } & {
    //       username?: string;
    //       avatar_url?: string;
    //     });

    type DiscordBotInfo = {
      username?: string;
      avatar_url?: string;
    };

    const data: DiscordMessage & DiscordBotInfo = {
      ...content,
      username: BOT_USERNAME,
      avatar_url: URL_AVATAR,
    };
    const options = {
      method: 'POST',
      url: DISCORD_WEBHOOK_URL,
      data,
    };

    if (RICH_EMBED && clipInfo) {
      const initialMessage = {
        method: options.method,
        url: options.url,
        data: {
          content: `*${clipInfo.title}*\n${clipInfo.url}`,
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
                  insertClipIdToDb(clipId);
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
    } else {
      axios
        .request(options)
        .then((response) => {
          if (response.status === 204) {
            insertClipIdToDb(clipId);
          }
        })
        .catch((err) => {
          logger.log('error', 'ERROR: posting to Discord', err);
        });
    }
  }

  function buildMessage({
    userInfo,
    broadcasterInfo,
    gameInfo,
    clipInfo,
  }: {
    userInfo: UserInfo;
    broadcasterInfo: BroadcasterInfo;
    gameInfo: GameInfo;
    clipInfo: ClipInfo;
  }): DiscordMessage {
    if (!RICH_EMBED) {
      let playingStr = '';
      // underscores, and asterisks on the next two lines are Discord markdown formatting
      if (gameInfo) playingStr = ` playing __${gameInfo.name}__`;
      const string = `*${clipInfo.title}*\n**${userInfo.display_name}** created a clip of **${broadcasterInfo.display_name}**${playingStr}\n${clipInfo.url}`;
      return { content: string };
    } else {
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

      // If we have gameInfo, add enhance embed message
      if (gameInfo) {
        richEmbedMessage.embeds[0].thumbnail = {
          url: gameInfo.box_art_url
            .replace('{height}', '80')
            .replace('{width}', '80'),
        };
        richEmbedMessage.embeds[0].fields.push({
          name: 'Game',
          value: gameInfo.name || '',
          inline: true,
        });
      }
      return richEmbedMessage;
    }
  }
}
