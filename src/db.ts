import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import logger from './logger.js';

export type PostedClip = {
  id: string;
  discordWebhooks: {
    url: string;
    date: number;
  }[];
};

export type Data = {
  postedClips: PostedClip[];
};

const defaultData: Data = { postedClips: [] };

export default class CliveDatabase extends Low<Data> {
  public constructor(dbFilePath: string) {
    const adapter = new JSONFile<Data>(dbFilePath);
    super(adapter, defaultData);
  }

  CheckDbForClip(clipId: string, discordWebhook: string) {
    const { postedClips } = this.data;
    const clip = postedClips.find((postedClip) => postedClip.id === clipId);
    const foundClip = clip?.discordWebhooks.find(
      ({ url }) => url == discordWebhook,
    );
    return foundClip;
  }

  InsertClipIdToDb(clipId: string, webhookURL: string): Promise<void> {
    if (!clipId) {
      logger.log('error', 'No clipId was passed when inserting to database!');
      return new Promise((resolve) => resolve());
    }

    const { postedClips } = this.data;
    let clipIndex = postedClips.findIndex(
      (postedClip) => postedClip.id === clipId,
    );
    if (clipIndex < 0) {
      return this.update(({ postedClips }) =>
        postedClips.push({
          id: clipId,
          discordWebhooks: [{ url: webhookURL, date: Date.now() }],
        }),
      );
    }

    return this.update(({ postedClips }) => {
      postedClips[clipIndex].discordWebhooks.push({
        url: webhookURL,
        date: Date.now(),
      });
      return postedClips;
    });
  }
}
