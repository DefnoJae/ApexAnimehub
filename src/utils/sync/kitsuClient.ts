import type { SyncStatus, AnimeEntry } from '../../types/sync';

const KITSU_API = 'https://kitsu.io/api/edge';

export class KitsuClient {
  private accessToken: string | null = null;
  private userId: string | null = null;

  constructor() {
    this.accessToken = localStorage.getItem('kitsu_access_token');
    this.userId = localStorage.getItem('kitsu_user_id');
  }

  async authenticate(email: string, password: string): Promise<boolean> {
    try {
      const response = await fetch('https://kitsu.io/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          username: email,
          password,
        }).toString(),
      });

      if (!response.ok) throw new Error('Authentication failed');

      const data = await response.json();
      if (typeof data.access_token !== 'string') throw new Error('Invalid Kitsu token');
      const userResponse = await fetch(KITSU_API + '/users?filter[self]=true', { headers: { Authorization: 'Bearer ' + data.access_token, Accept: 'application/vnd.api+json' } });
      if (!userResponse.ok) throw new Error('Kitsu user lookup failed');
      const users = await userResponse.json();
      if (typeof users.data?.[0]?.id !== 'string') throw new Error('Missing Kitsu user ID');
      this.accessToken = data.access_token;
      this.userId = users.data[0].id;

      localStorage.setItem('kitsu_access_token', data.access_token);
      localStorage.setItem('kitsu_user_id', users.data[0].id);
      return true;
    } catch (error) {
      console.error('Kitsu authentication error:', error);
      return false;
    }
  }

  async updateAnimeProgress(
    kitsuAnimeId: string,
    episodeWatched: number,
    totalEpisodes?: number
  ): Promise<SyncStatus> {
    if (!this.accessToken || !this.userId) {
      return {
        success: false,
        provider: 'kitsu',
        episode: episodeWatched,
        timestamp: Date.now(),
        error: 'Not authenticated',
      };
    }

    try {
      let entry = await this.getLibraryEntry(kitsuAnimeId);
      if (!entry) {
        return await this.createLibraryEntry(kitsuAnimeId, episodeWatched, totalEpisodes);
      }

      const status = totalEpisodes && episodeWatched >= totalEpisodes ? 'completed' : 'current';

      const response = await fetch(`${KITSU_API}/library-entries/${entry.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/vnd.api+json',
        },
        body: JSON.stringify({
          data: {
            type: 'libraryEntries',
            id: entry.id,
            attributes: { status, progress: episodeWatched },
          },
        }),
      });

      if (!response.ok) throw new Error('Update failed');

      return {
        success: true,
        provider: 'kitsu',
        episode: episodeWatched,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Kitsu update error:', error);
      return {
        success: false,
        provider: 'kitsu',
        episode: episodeWatched,
        timestamp: Date.now(),
        error: String(error),
      };
    }
  }

  async searchAnime(query: string): Promise<AnimeEntry[]> {
    try {
      const response = await fetch(
        `${KITSU_API}/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=10&fields[anime]=id,canonicalTitle,episodeCount,posterImage`
      );

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      return data.data?.map((item: { id: string; attributes?: { canonicalTitle?: string; episodeCount?: number; posterImage?: { small?: string } } }) => ({
        id: parseInt(item.id),
        title: item.attributes?.canonicalTitle || '',
        episodes: item.attributes?.episodeCount || 0,
        coverImage: item.attributes?.posterImage?.small || '',
      })) || [];
    } catch (error) {
      console.error('Kitsu search error:', error);
      return [];
    }
  }

  private async getLibraryEntry(animeId: string): Promise<{ id: string } | null> {
    try {
      const response = await fetch(
        `${KITSU_API}/library-entries?filter[userId]=${this.userId}&filter[animeId]=${animeId}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (!response.ok) throw new Error('Kitsu library lookup failed');
      const data = await response.json();
      return data.data?.[0] || null;
    } catch (error) {
      throw error;
    }
  }

  private async createLibraryEntry(
    animeId: string,
    progress: number,
    totalEpisodes?: number
  ): Promise<SyncStatus> {
    try {
      const status = totalEpisodes && progress >= totalEpisodes ? 'completed' : 'current';

      const response = await fetch(`${KITSU_API}/library-entries`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/vnd.api+json',
        },
        body: JSON.stringify({
          data: {
            type: 'libraryEntries',
            attributes: { status, progress },
            relationships: {
              anime: { data: { type: 'anime', id: animeId } },
              user: { data: { type: 'users', id: this.userId } },
            },
          },
        }),
      });

      if (!response.ok) throw new Error('Create entry failed');

      return {
        success: true,
        provider: 'kitsu',
        episode: progress,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Kitsu create entry error:', error);
      return {
        success: false,
        provider: 'kitsu',
        episode: progress,
        timestamp: Date.now(),
        error: String(error),
      };
    }
  }

  logout(): void {
    this.accessToken = null;
    this.userId = null;
    localStorage.removeItem('kitsu_access_token');
    localStorage.removeItem('kitsu_user_id');
  }
}

export const kitsuClient = new KitsuClient();
