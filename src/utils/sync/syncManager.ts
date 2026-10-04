import { malClient } from './malClient';
import { aniListClient } from './aniListClient';
import { kitsuClient } from './kitsuClient';
import type { SyncSettings, SyncStatus, AnimeEntry } from '../../types/sync';

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
    const jobs: Array<{ provider: string; run: () => Promise<SyncStatus> }> = [];
    for (const provider of ['mal', 'anilist', 'kitsu']) {
      if (!this.settings.providers[provider]?.accessToken) continue;
      const run = provider === 'mal' && malId ? () => malClient.updateAnimeProgress(malId, episode, totalEpisodes)
        : provider === 'anilist' && aniListId ? () => aniListClient.updateAnimeProgress(aniListId, episode, totalEpisodes)
        : provider === 'kitsu' && kitsuId ? () => kitsuClient.updateAnimeProgress(kitsuId, episode, totalEpisodes)
        : async (): Promise<SyncStatus> => ({ success: false, provider, episode, timestamp: Date.now(), error: 'Missing provider anime ID' });
      jobs.push({ provider, run });
    }
    const settled = await Promise.allSettled(jobs.map(job => Promise.resolve().then(job.run)));
    const results: SyncStatus[] = settled.map((result, index) => result.status === 'fulfilled' ? result.value : {
      success: false, provider: jobs[index].provider, episode, timestamp: Date.now(), error: String(result.reason),
    });

    if (this.settings.notifyOnSync && results.length > 0) {
      this.notifySync(anime.title, episode, results);
    }

    return results;
  }

  private notifySync(title: string, episode: number, results: SyncStatus[]): void {
    const successCount = results.filter((r) => r.success).length;
    const failures = results.filter(r => !r.success).map(r => `${r.provider}: ${r.error}`).join("; ");
    const message = `Synced "${title}" Episode ${episode} to ${successCount} service(s)${failures ? ". Failed: " + failures : ""}`;

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
