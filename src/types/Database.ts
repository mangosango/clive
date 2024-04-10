export type Database = {
  postedClipIds: StoredClipInfo[];
};

export type StoredClipInfo = {
  id: string;
  date: number;
};
