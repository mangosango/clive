const _ = require('lodash');
const request = require('request');
const tmi = require('tmi.js');

const DISCORD_WEBHOOK_URL =
  _.get(process, 'env.DISCORD_WEBHOOK_URL') || 'YOUR_DISCORD_WEBHOOK_URL_HERE';
const TWITCH_CHANNELS = generateChannelList(
  _.get(process, 'env.TWITCH_CHANNELS') || ['TwitchChannel AnotherChannel'],
);
const MODS_ONLY = _.get(process, 'env.MODS_ONLY') == 'true' || false;
const SUBS_ONLY = _.get(process, 'env.SUBS_ONLY') == 'true' || false;

const options = {
  options: {
    debug: false,
  },
  connection: {
    reconnect: true,
  },
  channels: TWITCH_CHANNELS,
};

const client = new tmi.client(options);

client.on('message', function(channel, userstate, message, self) {
  // Don't listen to my own messages..
  if (self) return;
  // Mods only
  if (MODS_ONLY && !userstate['mod']) return;
  // Subs only
  if (SUBS_ONLY && !userstate['subscriber']) return;

  // Handle different message types..
  switch (userstate['message-type']) {
    case 'action':
      // This is an action message..
      break;
    case 'chat':
      // console.log(userstate);
      if (message.indexOf('clips.twitch.tv/') !== -1) {
        postThing(`**${userstate['display-name']}** posted a clip: ${message}`);
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

function postThing(val) {
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
        console.log(body);
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
