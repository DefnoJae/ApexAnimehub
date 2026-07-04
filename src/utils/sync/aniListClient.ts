import type { SyncStatus, AnimeEntry } from '../types/sync';

const ANILIST_CLIENT_ID = process.env.REACT_APP_ANILIST_CLIENT_ID || '';
const ANILIST_REDIRECT_URI = process.env.REACT_APP_ANILIST_REDIRECT_URI || 'http://localhost:3000/oauth/anilist';
const ANILIST_API = 'https://graphql.anilist.co';

export class AniListClient {
  private accessToken: string | null = null;

  constructor() {
    this.accessToken = localStorage.getItem('anilist_access_token');
  }

  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: ANILIST_CLIENT_ID,
      redirect_uri: ANILIST_REDIRECT_URI,
      response_type: 'code',
    });
    return `https://anilist.co/api/v2/oauth/authorize?${params.toString()}`;
  }

  async authenticate(code: string): Promise<boolean> {
    try {
      const response = await fetch('https://anilist.co/api/v2/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: ANILIST_CLIENT_ID,
          client_secret: process.env.REACT_APP_ANILIST_CLIENT_SECRET,
          redirect_uri: ANILIST_REDIRECT_URI,
          code,
        }),
      });

      if (!response.ok) throw new Error('Authentication failed');

      const data = await response.json();
      this.accessToken = data.access_token;
      localStorage.setItem('anilist_access_token', this.accessToken);
      return true;
    } catch (error) {
      console.error('AniList authentication error:', error);
      return false;
    }
  }

  async updateAnimeProgress(
    aniListId: number,
    episodeWatched: number,
    totalEpisodes?: number
  ): Promise<SyncStatus> {
    if (!this.accessToken) {
      return {
        success: false,
        provider: 'anilist',
        episode: episodeWatched,
        timestamp: Date.now(),
        error: 'Not authenticated',
      };
    }

    try {
      const mutation = `
        mutation UpdateMediaList($mediaId: Int, $progress: Int, $status: MediaListStatus) {
          SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status) {
            id
            progress
            status
          }
        }
      `;

      const status = totalEpisodes && episodeWatched >= totalEpisodes ? 'COMPLETED' : 'CURRENT';

      const response = await fetch(ANILIST_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            mediaId: aniListId,
            progress: episodeWatched,
            status,
          },
        }),
      });

      const data = await response.json();

      if (data.errors) throw new Error(data.errors[0].message);

      return {
        success: true,
        provider: 'anilist',
        episode: episodeWatched,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('AniList update error:', error);
      return {
        success: false,
        provider: 'anilist',
        episode: episodeWatched,
        timestamp: Date.now(),
        error: String(error),
      };
    }
  }

  async searchAnime(query: string): Promise<AnimeEntry[]> {
    if (!this.accessToken) return [];

    try {
      const searchQuery = `
        query SearchAnime($search: String) {
          Page(perPage: 10) {
            media(search: $search, type: ANIME) {
              id
              title { english romaji }
              episodes
              coverImage { large }
            }
          }
        }
      `;

      const response = await fetch(ANILIST_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          variables: { search: query },
        }),
      });

      const data = await response.json();

      if (data.errors) throw new Error(data.errors[0].message);

      return data.data?.Page?.media?.map((item: any) => ({
        id: item.id,
        title: item.title?.english || item.title?.romaji || '',
        episodes: item.episodes || 0,
        coverImage: item.coverImage?.large || '',
      })) || [];
    } catch (error) {
      console.error('AniList search error:', error);
      return [];
    }
  }

  logout(): void {
    this.accessToken = null;
    localStorage.removeItem('anilist_access_token');
  }
}

export const aniListClient = new AniListClient();
