const _ = require('lodash');

// Takes space-separated string of twitch channels parses them, adds a # prefix, and puts them into an array
function generateChannelList(channelsString) {
  const channelArray = _.split(channelsString, ' ');

  return channelArray.map((channel) => {
    return `#${channel.toLowerCase()}`;
  });
}

module.exports = {
  BOT_USERNAME: _.get(process, 'env.BOT_USERNAME'),
  BROADCASTER_ONLY: _.get(process, 'env.BROADCASTER_ONLY', false) === 'true',
  DB_FILE: _.get(process, 'env.DB_FILE') || 'db.json',
  DISCORD_WEBHOOK_URL: _.get(process, 'env.DISCORD_WEBHOOK_URL'),
  MODS_ONLY: _.get(process, 'env.MODS_ONLY', false) === 'true',
  RESTRICT_CHANNELS: _.get(process, 'env.RESTRICT_CHANNELS', true) === 'true',
  RICH_EMBED: _.get(process, 'env.RICH_EMBED', false) === 'true',
  SUBS_ONLY: _.get(process, 'env.SUBS_ONLY', false) === 'true',
  TWITCH_CHANNELS: generateChannelList(_.get(process, 'env.TWITCH_CHANNELS')),
  URL_AVATAR: _.get(process, 'env.URL_AVATAR'),
};
