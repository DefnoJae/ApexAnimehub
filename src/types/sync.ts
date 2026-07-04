// Type definitions for sync
export interface SyncProvider {
  id: 'mal' | 'anilist' | 'kitsu';
  name: string;
  authUrl: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface SyncSettings {
  providers: Record<string, SyncProvider>;
  autoSync: boolean;
  syncOnPlay: boolean;
  syncOnPause: boolean;
  notifyOnSync: boolean;
}

export interface AnimeEntry {
  id: number;
  title: string;
  episodes: number;
  coverImage?: string;
}

export interface SyncStatus {
  success: boolean;
  provider: string;
  episode: number;
  timestamp: number;
  error?: string;
}

export interface MALResponse {
  data?: any[];
}

export interface AniListResponse {
  data?: any;
  errors?: Array<{ message: string }>;
}

export interface KitsuResponse {
  data?: Array<any>;
}
