'require strict';
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').load();
}
const _ = require('lodash');
const request = require('request');
const tmi = require('tmi.js');
const winston = require('winston');
winston.level = _.get(process, 'env.LOG_LEVEL') || 'error';

const DISCORD_WEBHOOK_URL =
  _.get(process, 'env.DISCORD_WEBHOOK_URL') || 'YOUR_DISCORD_WEBHOOK_URL_HERE';
const TWITCH_CHANNELS = generateChannelList(
  _.get(process, 'env.TWITCH_CHANNELS') || ['TwitchChannel AnotherChannel'],
);
const MODS_ONLY = _.get(process, 'env.MODS_ONLY') == 'true' || false;
const SUBS_ONLY = _.get(process, 'env.SUBS_ONLY') == 'true' || false;

winston.log('info', 'Config settings:\n', {
  DISCORD_WEBHOOK_URL,
  TWITCH_CHANNELS,
  MODS_ONLY,
  SUBS_ONLY,
});

const options = {
  options: {
    debug: _.get(process, 'env.LOG_LEVEL') == 'debug' || false,
  },
  connection: {
    reconnect: true,
  },
  channels: TWITCH_CHANNELS,
};

const client = new tmi.client(options);

client.on('message', function(channel, userstate, message, self) {
  winston.log('debug', 'New message');
  winston.log('debug', 'Channel: ', channel);
  winston.log('debug', 'Userstate: ', userstate);
  winston.log('debug', 'Message: ', message);

  // Don't listen to my own messages..
  if (self) return;
  // Mods only
  if (MODS_ONLY && !userstate['mod']) {
    winston.log('debug', `NON-MOD posted a clip: ${message}`);
    return;
  }
  // Subs only
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
        winston.log('debug', `Twitch clip posted in chat: ${message}`);
        postToDiscord(
          `**${userstate['display-name']}** posted a clip: ${message}`,
        );
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
    function(error, response, body) {
      if (!error && response.statusCode == 200) {
        winston.log('error', 'Error posting to Discord', body);
      }
    },
  );
}

function generateChannelList(channelsString) {
  let channelArray = _.split(channelsString, ' ');

  return channelArray.map(function(channel) {
    return `#${channel}`;
  });
}
