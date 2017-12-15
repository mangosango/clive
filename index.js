'use strict';
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').load();
}
const _ = require('lodash');
const request = require('request-promise');
const tmi = require('tmi.js');
const URI = require('urijs');
const winston = require('winston');
winston.level = _.get(process, 'env.LOG_LEVEL') || 'error';

const DISCORD_WEBHOOK_URL =
  _.get(process, 'env.DISCORD_WEBHOOK_URL') || 'YOUR_DISCORD_WEBHOOK_URL_HERE';
const TWITCH_CHANNELS = generateChannelList(
  _.get(process, 'env.TWITCH_CHANNELS') || ['TwitchChannel AnotherChannel'],
);
const TWITCH_CLIENT_ID = _.get(process, 'env.TWITCH_CLIENT_ID') || null;
const BROADCASTER_ONLY =
  _.get(process, 'env.BROADCASTER_ONLY') === 'true' || false;
const MODS_ONLY = _.get(process, 'env.MODS_ONLY') === 'true' || false;
const SUBS_ONLY = _.get(process, 'env.SUBS_ONLY') === 'true' || false;

winston.log('info', 'Config settings:\n', {
  DISCORD_WEBHOOK_URL,
  TWITCH_CHANNELS,
  BROADCASTER_ONLY,
  MODS_ONLY,
  SUBS_ONLY,
});
winston.log('info', `Twitch Client ID is ${TWITCH_CLIENT_ID ? '' : 'NOT '}set`);

const tmiOptions = {
  options: {
    debug: _.get(process, 'env.LOG_LEVEL') === 'debug' || false,
  },
  connection: {
    reconnect: true,
  },
  channels: TWITCH_CHANNELS,
};

const client = new tmi.client(tmiOptions);

// Check messages that are posted in twitch chat
client.on('message', (channel, userstate, message, self) => {
  winston.log('debug', 'New message');
  winston.log('debug', 'Channel: ', channel);
  winston.log('debug', 'Userstate: ', userstate);
  winston.log('debug', 'Message: ', message);

  // Don't listen to my own messages..
  if (self) return;
  // Broadcaster only mode
  const isBroadcaster = userstate['badges'].broadcaster === '1';
  if (BROADCASTER_ONLY && !isBroadcaster) {
    winston.log('debug', `NON-BROADCASTER posted a clip: ${message}`);
    return;
  }
  // Mods only mode
  if (MODS_ONLY && !(userstate['mod'] || isBroadcaster)) {
    winston.log('debug', `NON-MOD posted a clip: ${message}`);
    return;
  }
  // Subs only mode
  if (SUBS_ONLY && !userstate['subscriber']) {
    winston.log('debug', `NON-SUB posted a clip: ${message}`);
    return;
  }

  // Handle different message types..
  switch (userstate['message-type']) {
    case 'action':
      // This is an action message..
      break;
    case 'chat':
      if (message.indexOf('clips.twitch.tv/') !== -1) {
        winston.log('debug', `Clip detected in message: ${message}`);
        if (TWITCH_CLIENT_ID) {
          postUsingTwitchAPI(message);
        } else {
          postUsingMessageInfo(message);
        }
      }
      break;
    case 'whisper':
      // This is a whisper..
      break;
    default:
      // Something else ?
      break;
  }
});

// Connect the client to the server..
client.connect();

function postUsingTwitchAPI(message) {
  const clipId = getUrlSlug(message);
  twitchApiGetCall('clips', clipId).then(clipInfo => {
    winston.log('debug', 'Twitch clip results:', clipInfo);
    Promise.all([
      twitchApiGetCall('users', clipInfo.creator_id),
      twitchApiGetCall('games', clipInfo.game_id),
    ]).then(results => {
      winston.log('debug', 'Async results:', results);
      postToDiscord(
        `**${results[0].display_name}** posted a clip during ${
          results[1].name
        }: *${clipInfo.title}*\n${clipInfo.url}`,
      );
    });
  });
}

function postUsingMessageInfo(message) {
  postToDiscord(`**${userstate['display-name']}** posted a clip: ${message}`);
}

function getUrlSlug(message) {
  // split message by spaces, then filter out anything that's not a twitch clip
  const urls = _.filter(_.split(message, ' '), messagePart => {
    return messagePart.indexOf('clips.twitch.tv/') !== -1;
  });
  winston.log('debug', `Found ${urls.length} urls: `, urls);
  if (urls.length < 1) {
    winston.log('error', 'No urls found in message', message);
    return;
  }

  const path = URI(urls[0]).path();
  const clipId = path.replace('/', '');
  if (!path || !clipId) {
    winston.log('error', 'Something wrong with this url', urls[0]);
    return;
  }
  winston.log('debug', `Clip slug: ${clipId}`);
  return clipId;
}

async function twitchApiGetCall(endpoint, id) {
  if (!TWITCH_CLIENT_ID) return;
  const options = {
    uri: `https://api.twitch.tv/helix/${endpoint}`,
    qs: {
      id: id,
    },
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
    },
    json: true,
  };
  winston.log('info', `Calling /${endpoint}?id=${id}`);
  try {
    const response = await request(options);
    return response.data[0];
  } catch (err) {
    winston.log('error', `Error calling twitch API /${endpoint}:`, err);
    return;
  }
}

function postToDiscord(val) {
  request.post(
    DISCORD_WEBHOOK_URL,
    {
      json: {
        content: val,
        username: 'Clive',
        avatar_url: 'http://i.imgur.com/9s3TBNv.png',
      },
    },
    (error, response, body) => {
      if (error) {
        winston.log('error', 'Error posting to Discord', response, body);
      } else if (response.statusCode === 200) {
        winston.log('info', body);
      }
    },
  );
}

// Takes space-separated string of twitch channels parses them, adds a # prefix, and puts them into an array
function generateChannelList(channelsString) {
  let channelArray = _.split(channelsString, ' ');

  return channelArray.map(channel => {
    return `#${channel}`;
  });
}
