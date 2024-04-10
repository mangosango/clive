export type Database = {
  postedClips: PostedClip[];
};

export type PostedClip = {
  id: string;
  discordWebhooks: {
    url: string;
    date: number;
  }[];
};
