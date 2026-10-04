import { fetchAnilist } from '../anilist';
import type { SyncStatus, AnimeEntry } from '../../types/sync';


export class AniListClient {

  constructor() {
    localStorage.removeItem('anilist_access_token');
  }

  getAuthorizationUrl(): string {
    return "/api/oauth/anilist/start";
  }

  async authenticate(): Promise<boolean> {
    const response = await fetch('/api/oauth/anilist/session', { credentials: 'same-origin' });
    return response.ok;
  }

  async updateAnimeProgress(
    aniListId: number,
    episodeWatched: number,
    totalEpisodes?: number
  ): Promise<SyncStatus> {
    if (!(await this.authenticate())) {
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

      const response = await fetch('/api/oauth/anilist/graphql', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mutation, variables: { mediaId: aniListId, progress: episodeWatched, status } }),
      });
      if (!response.ok) throw new Error('AniList sync failed (' + response.status + ')');
      const data = await response.json();
      if (data.errors?.length || !data.data?.SaveMediaListEntry) throw new Error(data.errors?.[0]?.message || 'Missing AniList update result');

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

      const data = await fetchAnilist<{ Page: { media: Array<{ id: number; title: { english?: string; romaji?: string }; episodes?: number; coverImage?: { large: string } }> } }>(searchQuery, { search: query });
      return data.Page.media?.map((item) => ({
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
    localStorage.removeItem('anilist_access_token');
    void fetch('/api/oauth/anilist/logout', { method: 'POST' });
  }
}

export const aniListClient = new AniListClient();
