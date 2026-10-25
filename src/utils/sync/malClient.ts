import { randomToken, beginOAuth, validateOAuth } from './oauth';
import type { SyncStatus, AnimeEntry } from '../../types/sync';

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
    const state = beginOAuth('mal');
    const codeVerifier = this.generateCodeVerifier();
    sessionStorage.setItem('mal_code_verifier', codeVerifier);

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

  async authenticate(code: string, state: string): Promise<boolean> {
    try {
      validateOAuth('mal', state);
      const codeVerifier = sessionStorage.getItem('mal_code_verifier') || '';
      sessionStorage.removeItem('mal_code_verifier');
      if (!codeVerifier || !code) throw new Error('Missing OAuth code or verifier');
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
      if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') throw new Error('Invalid token response');
      this.setTokens(data.access_token, data.refresh_token, data.expires_in || 3600);
      sessionStorage.removeItem('mal_code_verifier');
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
    await this.refreshTokenIfNeeded();
    if (!this.isAuthenticated()) {
      return {
        success: false,
        provider: 'mal',
        episode: episodeWatched,
        timestamp: Date.now(),
        error: 'Not authenticated',
      };
    }

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
    await this.refreshTokenIfNeeded();
    if (!this.isAuthenticated()) return [];

    try {
      const response = await fetch(
        `${MAL_API_BASE}/anime?q=${encodeURIComponent(query)}&limit=10&fields=id,title,num_episodes,main_picture`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      return data.data?.map((item: { node: { id: number; title?: string; num_episodes?: number; main_picture?: { large?: string } } }) => ({
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
    return randomToken(32);
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
