import CliveDatabase from './db.js';
import Discord from './discord.js';
import Twitch, { ClipInfo } from './twitch.js';
import logger from './logger.js';
import {
  Commands,
  PrivateMessage,
  PrivateMessages,
  UserStateTags,
} from 'twitch-js';
import { DiscordConfig } from './config.js';

export default class Clive {
  private db: CliveDatabase;
  private twitch: Twitch;
  private discord: Discord;
  constructor(db: CliveDatabase, twitch: Twitch, discord: Discord) {
    this.db = db;
    this.twitch = twitch;
    this.discord = discord;
  }

  public async connectToTwitchChat() {
    const isAppTokenSet = await this.twitch.setAppToken();
    if (isAppTokenSet) {
      await this.twitch.setChannelIds();
    }
    return Twitch.createTwitchChatClient(this.twitch);
  }

  public async handlePrivateMessage(message: PrivateMessages) {
    // Don't listen to my own messages..
    if (message.isSelf) return;

    if (!Twitch.clipsRegex.test(message.message)) {
      return;
    }
    const clipId = Twitch.getClipUrlSlug(message.message);
    logger.log(
      'debug',
      `CLIP: ${clipId} DETECTED: in message: ${message.message}`,
    );

    // Handle different message types..
    switch (message.event) {
      case Commands.PRIVATE_MESSAGE:
        const clipInfo = await this.twitch.getClipInfo(clipId);

        this.discord.configs.forEach((discordConfigs) => {
          this.postClipToDiscord(clipInfo, message, discordConfigs);
        });
        break;
      default:
        // Something else ?
        break;
    }
  }

  private async postClipToDiscord(
    clipInfo: ClipInfo,
    message: PrivateMessages,
    discordConfig: DiscordConfig,
  ): Promise<void> {
    // check if its this clip has already been posted
    const posted = this.db.CheckDbForClip(
      clipInfo.id,
      discordConfig.webhookURL,
    );
    if (posted) {
      logger.log(
        'info',
        `PREVIOUSLY POSTED CLIP: ${clipInfo.id} was posted on ${new Date(
          posted.date,
        )} to Discord webhook: ${discordConfig.webhookURL}`,
      );
      return;
    }

    if (this.isClipPermitted(discordConfig, clipInfo, message)) {
      const displayName = message.tags.displayName;
      const discordMessage = Discord.buildMessage(
        clipInfo,
        discordConfig.useRichEmbed,
        displayName,
      );
      const success = await Discord.postMessage(
        discordConfig,
        discordMessage,
        clipInfo,
      );
      if (success) {
        this.db.InsertClipIdToDb(clipInfo.id, discordConfig.webhookURL);
      }
    }
  }

  public isClipPermitted(
    discordConfig: DiscordConfig,
    clipInfo: ClipInfo,
    message: PrivateMessages,
  ): boolean {
    const { permissions } = discordConfig;
    const listedTwitchChannels = discordConfig.twitchChannels;
    const listedTwitchChannelIds =
      this.twitch.getChannelIds(listedTwitchChannels);

    const user = message.username;

    // Filter all messages for the correct Discord channels
    // Bot can be connected to multiple channels at once and messages come
    //   from all connected channels but may not map to all Discords
    const isListedChannel = listedTwitchChannels.some((listedTwitchChannel) => {
      return listedTwitchChannel === message.channel.toLowerCase();
    });
    if (!isListedChannel) {
      return false;
    }

    if (
      clipInfo?.broadcaster_id &&
      discordConfig.permissions?.listedChannelsOnly &&
      listedTwitchChannelIds.indexOf(clipInfo.broadcaster_id) === -1
    ) {
      logger.log('info', 'OUTSIDER CLIP: Posted in chat from tracked channel');
      return false;
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
      return true;
    }

    // if (permissions.allowFollowers && isFollower) {
    //   return true;
    // }

    // if (permissions.allowVIPs && isVIP) {
    //   return true;
    // }

    if (permissions.allowSubs && isSub) {
      return true;
    }

    if (permissions.allowMods && isMod) {
      return true;
    }

    if (permissions.allowBroadcaster && isBroadcaster) {
      return true;
    }

    logger.log(
      'info',
      `No permissions for user: ${user} (${JSON.stringify({ isBroadcaster, isMod, isSub })})
          \tin discord: ${discordConfig.webhookURL}
          \tsharing clip: ${message.message}
          \tUsing permission set: ${JSON.stringify(permissions)}`,
    );
    return false;
  }
}
