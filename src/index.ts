import { Commands } from 'twitch-js';

// types
import Discord from './discord.js';

// local imports
import logger from './logger.js';
import Twitch from './twitch.js';
import CliveDatabase from './db.js';
import config from './config.js';
import Clive from './clive.js';

main();
async function main(): Promise<void> {
  logStartInfo();
  const db = new CliveDatabase(config.dbFile);
  const twitch = new Twitch(config);
  const discord = new Discord(config);
  const clive = new Clive(db, twitch, discord);

  const twitchChat = await clive.connectToTwitchChat();
  twitchChat.on(Commands.PRIVATE_MESSAGE, clive.handlePrivateMessage);
}

function logStartInfo(): void {
  const redactedConfig = structuredClone(config);
  delete redactedConfig.twitchClientSecret;
  logger.log('debug', 'CONFIG SETTINGS:\n', {
    ...redactedConfig,
  });
}
