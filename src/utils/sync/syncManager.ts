import { malClient } from './malClient';
import { aniListClient } from './aniListClient';
import { kitsuClient } from './kitsuClient';
import type { SyncSettings, SyncStatus, AnimeEntry } from '../types/sync';

export class SyncManager {
  private settings: SyncSettings;

  constructor(settings: SyncSettings) {
    this.settings = settings;
  }

  async syncEpisodeProgress(
    anime: AnimeEntry,
    episode: number,
    totalEpisodes: number,
    malId?: number,
    aniListId?: number,
    kitsuId?: string
  ): Promise<SyncStatus[]> {
    const results: SyncStatus[] = [];

    if (this.settings.providers['mal']?.accessToken && malId) {
      results.push(await malClient.updateAnimeProgress(malId, episode, totalEpisodes));
    }

    if (this.settings.providers['anilist']?.accessToken && aniListId) {
      results.push(await aniListClient.updateAnimeProgress(aniListId, episode, totalEpisodes));
    }

    if (this.settings.providers['kitsu']?.accessToken && kitsuId) {
      results.push(await kitsuClient.updateAnimeProgress(kitsuId, episode, totalEpisodes));
    }

    if (this.settings.notifyOnSync && results.length > 0) {
      this.notifySync(anime.title, episode, results);
    }

    return results;
  }

  private notifySync(title: string, episode: number, results: SyncStatus[]): void {
    const successCount = results.filter((r) => r.success).length;
    const message = `Synced "${title}" Episode ${episode} to ${successCount} service(s)`;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(message, {
        tag: 'anime-sync',
      });
    } else {
      console.log(message);
    }
  }

  updateSettings(settings: Partial<SyncSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
}
