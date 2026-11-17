import { fetchAnilist } from '../anilist';
import { anilistRequest, getAniListToken, clearAniListToken } from '../anilistAuth';
import type { SyncStatus, AnimeEntry } from '../../types/sync';


export class AniListClient {

  constructor() {
    localStorage.removeItem('anilist_access_token');
  }

  getAuthorizationUrl(): string {
    return "/api/oauth/anilist/start";
  }

  async authenticate(): Promise<boolean> {
    try {
      await getAniListToken();
      return true;
    } catch {
      return false;
    }
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

      const data = await anilistRequest<{ SaveMediaListEntry?: unknown }>(
        mutation,
        { mediaId: aniListId, progress: episodeWatched, status },
        undefined,
      );
      if (!data?.SaveMediaListEntry) throw new Error('Missing AniList update result');

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
    clearAniListToken();
    void fetch('/api/oauth/anilist/logout', { method: 'POST' });
  }
}

export const aniListClient = new AniListClient();
