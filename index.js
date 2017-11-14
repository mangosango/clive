const _ = require('lodash');

const DISCORD_WEBHOOK_URL = _.get(process, 'env.DISCORD_WEBHOOK_URL') || "YOUR_DISCORD_WEBHOOK_URL_HERE";
const DISCORD_POST_DELAY = _.get(process, 'env.DISCORD_POST_DELAY') || 30 * 1000; // 30s
let channelArray = _.get(process, 'env.TWITCH_CHANNELS');

if (channelArray) {
	channelArray = _.split(channelArray, ' ');
} else {
	channelArray = ['YOUR_TWITCH_CHANNEL_HERE'];
}
const TWITCH_CHANNELS = channelArray.map(function (channel) {
	return `#${channel}`;
});

var request = require('request');
var tmi = require("tmi.js");

var options = {
  options: {
    debug: false
  },
  connection: {
    reconnect: true
  },
  channels: TWITCH_CHANNELS
};

var client = new tmi.client(options);

client.on("message", function (channel, userstate, message, self) {
  // Don't listen to my own messages..
  if (self) return;

  // Handle different message types..
  switch(userstate["message-type"]) {
    case "action":
      // This is an action message..
      break;
    case "chat":
      // console.log(userstate);
      if (message.indexOf("clips.twitch.tv/") !== -1) {
	// Delay the message to ensure its finished being genreated by Twitch
        setTimeout(
          postDiscordMessage(`**@${userstate["display-name"]}** posted a clip: ${message}`),
	  DISCORD_POST_DELAY);
      }
      break;
    case "whisper":
      // This is a whisper..
      break;
    default:
      // Something else ?
      break;
  }
});

// Connect the client to the server..
client.connect();

function postDiscordMessage(val) {
  request.post(
    DISCORD_WEBHOOK_URL,
    { json:
      {
        content: val,
        username: "Clive",
        avatar_url: "http://i.imgur.com/9s3TBNv.png",
      }
    },
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log(body)
      }
    }
  );
}
