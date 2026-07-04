import type { SyncStatus, AnimeEntry } from '@/types/sync';

const MAL_CLIENT_ID = process.env.REACT_APP_MAL_CLIENT_ID || '';
const MAL_REDIRECT_URI = process.env.REACT_APP_MAL_REDIRECT_URI || 'http://localhost:3000/oauth/mal';
const MAL_API_BASE = 'https://api.myanimelist.net/v2';

export class MALClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null;

  constructor() {
    this.loadTokens();
  }

  getAuthorizationUrl(): string {
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('mal_oauth_state', state);
    const codeVerifier = this.generateCodeVerifier();
    localStorage.setItem('mal_code_verifier', codeVerifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: MAL_CLIENT_ID,
      redirect_uri: MAL_REDIRECT_URI,
      state,
      code_challenge: codeVerifier,
      code_challenge_method: 'plain',
    });

    return `https://myanimelist.net/v1/oauth2/authorize?${params.toString()}`;
  }

  async authenticate(code: string): Promise<boolean> {
    try {
      const codeVerifier = localStorage.getItem('mal_code_verifier') || '';
      const response = await fetch('https://myanimelist.net/v1/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: MAL_CLIENT_ID,
          code_verifier: codeVerifier,
          redirect_uri: MAL_REDIRECT_URI,
        }).toString(),
      });

      if (!response.ok) throw new Error('Authentication failed');

      const data = await response.json();
      this.setTokens(data.access_token, data.refresh_token, data.expires_in || 3600);
      localStorage.removeItem('mal_code_verifier');
      return true;
    } catch (error) {
      console.error('MAL authentication error:', error);
      return false;
    }
  }

  async updateAnimeProgress(
    animeId: number,
    episodeWatched: number,
    totalEpisodes?: number
  ): Promise<SyncStatus> {
    if (!this.isAuthenticated()) {
      return {
        success: false,
        provider: 'mal',
        episode: episodeWatched,
        timestamp: Date.now(),
        error: 'Not authenticated',
      };
    }

    await this.refreshTokenIfNeeded();

    try {
      const status = totalEpisodes && episodeWatched >= totalEpisodes ? 'completed' : 'watching';

      const response = await fetch(`${MAL_API_BASE}/anime/${animeId}/my_list_status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          status,
          num_watched_episodes: episodeWatched.toString(),
        }).toString(),
      });

      if (!response.ok) throw new Error('Update failed');

      return {
        success: true,
        provider: 'mal',
        episode: episodeWatched,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('MAL update error:', error);
      return {
        success: false,
        provider: 'mal',
        episode: episodeWatched,
        timestamp: Date.now(),
        error: String(error),
      };
    }
  }

  async searchAnime(query: string): Promise<AnimeEntry[]> {
    if (!this.isAuthenticated()) return [];

    try {
      const response = await fetch(
        `${MAL_API_BASE}/anime?query=${encodeURIComponent(query)}&limit=10&fields=id,title,num_episodes,main_picture`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      return data.data?.map((item: any) => ({
        id: item.node?.id,
        title: item.node?.title || '',
        episodes: item.node?.num_episodes || 0,
        coverImage: item.node?.main_picture?.large || '',
      })) || [];
    } catch (error) {
      console.error('MAL search error:', error);
      return [];
    }
  }

  private isAuthenticated(): boolean {
    return !!(this.accessToken && (!this.expiresAt || Date.now() < this.expiresAt - 60000));
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    if (!this.expiresAt || Date.now() < this.expiresAt - 60000 || !this.refreshToken) return;

    try {
      const response = await fetch('https://myanimelist.net/v1/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: MAL_CLIENT_ID,
        }).toString(),
      });

      if (response.ok) {
        const data = await response.json();
        this.setTokens(data.access_token, data.refresh_token, data.expires_in || 3600);
      }
    } catch (error) {
      console.error('Token refresh error:', error);
    }
  }

  private setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = Date.now() + expiresIn * 1000;

    localStorage.setItem('mal_access_token', accessToken);
    localStorage.setItem('mal_refresh_token', refreshToken);
    localStorage.setItem('mal_expires_at', this.expiresAt.toString());
  }

  private loadTokens(): void {
    this.accessToken = localStorage.getItem('mal_access_token');
    this.refreshToken = localStorage.getItem('mal_refresh_token');
    const expiresAt = localStorage.getItem('mal_expires_at');
    this.expiresAt = expiresAt ? parseInt(expiresAt) : null;
  }

  private generateCodeVerifier(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    localStorage.removeItem('mal_access_token');
    localStorage.removeItem('mal_refresh_token');
    localStorage.removeItem('mal_expires_at');
  }
}

export const malClient = new MALClient();