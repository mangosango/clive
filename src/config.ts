// Takes space-separated string of twitch channels parses them, adds a # prefix, and puts them into an array
function generateChannelList(channelsString: string): string[] {
  const channelArray = channelsString?.split(' ') || [];

  return channelArray.map((channel) => {
    return `#${channel.toLowerCase()}`;
  });
}

export default {
  BOT_USERNAME: process?.env?.BOT_USERNAME,
  BROADCASTER_ONLY: !!(process?.env?.BROADCASTER_ONLY === 'true'),
  DB_FILE: process?.env?.DB_FILE || 'db.json',
  DISCORD_WEBHOOK_URL: process?.env?.DISCORD_WEBHOOK_URL,
  MODS_ONLY: !!(process?.env?.MODS_ONLY === 'true'),
  RESTRICT_CHANNELS: !!(process?.env?.RESTRICT_CHANNELS === 'true'),
  RICH_EMBED: !!(process?.env?.RICH_EMBED === 'true'),
  SUBS_ONLY: !!(process?.env?.SUBS_ONLY === 'true'),
  TWITCH_CHANNELS: generateChannelList(process?.env?.TWITCH_CHANNELS || ''),
  URL_AVATAR: process?.env?.URL_AVATAR,
};
