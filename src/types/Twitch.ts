export type UserInfo = {
  id: string;
  login: string;
  display_name: string;
  type?: string;
  broadcaster_type?: string;
  description?: string;
  profile_image_url?: string;
  offline_image_url?: string;
  view_count: number;
  created_at: string;
};

export type BroadcasterInfo = {
  id: string;
  login: string;
  display_name: string;
  type?: string;
  broadcaster_type?: string;
  description?: string;
  profile_image_url?: string;
  offline_image_url?: string;
  view_count: number;
  created_at: string;
};
export type GameInfo = {
  id: string;
  name: string;
  box_art_url: string;
  igdb_id?: string;
};

export type ClipInfo = {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  vod_offset: number;
  is_featured: boolean;
};
