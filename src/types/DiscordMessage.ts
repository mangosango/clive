import { ClipInfo, GameInfo, UserInfo } from './Twitch.js';

export type DiscordMessage = SimpleMessage | RichEmbedMessage;

type SimpleMessage = { content: string };

export type RichEmbedMessage = {
  content: string;
  embeds: {
    title: ClipInfo['title'];
    url: ClipInfo['url'];
    color: number;
    timestamp: ClipInfo['created_at'];
    thumbnail?: {
      url: GameInfo['box_art_url'];
    };
    author: {
      name: UserInfo['display_name'];
      url: string;
      icon_url: UserInfo['profile_image_url'];
    };
    fields: {
      name: string;
      value: string;
      inline: boolean;
    }[];
  }[];
};
