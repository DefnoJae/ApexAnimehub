import { webcrypto } from 'crypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
import { mondayOffset, getWeekStart } from './schedule';
import { fetchAnilist } from './anilist';
import { fetchDubSchedule } from './dubSchedule';
import { beginOAuth, validateOAuth } from './sync/oauth';
import { MALClient } from './sync/malClient';
import { SyncManager } from './sync/syncManager';
import { malClient } from './sync/malClient';
import { aniListClient } from './sync/aniListClient';
import { kitsuClient } from './sync/kitsuClient';
import type { SyncSettings } from '../types/sync';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.restoreAllMocks(); global.fetch = jest.fn(); });
const response = (data: unknown, status = 200) => ({ ok: status === 200, status, json: async () => data } as Response);

test('Monday calendar offsets cover Monday, Sunday and leap day', () => {
  expect(mondayOffset(new Date(2026, 5, 1))).toBe(0);
  expect(mondayOffset(new Date(2026, 1, 1))).toBe(6);
  expect(mondayOffset(new Date(2024, 1, 29))).toBe(3);
  expect(getWeekStart(new Date(2026, 9, 7, 18)).getHours()).toBe(0);
});
test('AniList rejects HTTP, GraphQL and missing-data failures', async () => {
  const mock = global.fetch as jest.Mock;
  mock.mockResolvedValueOnce(response({}, 429));
  await expect(fetchAnilist('query {}')).rejects.toThrow('rate limit');
  mock.mockResolvedValueOnce(response({ errors: [{ message: 'Bad query' }] }));
  await expect(fetchAnilist('query {}')).rejects.toThrow('Bad query');
  mock.mockResolvedValueOnce(response({}));
  await expect(fetchAnilist('query {}')).rejects.toThrow('no data');
});
test('schedule falls back to saved data on network failure and ignores corrupt cache', async () => {
  const entries = [{ title: 'Example', episodeDate: '2026-10-04T12:00:00Z', episodeNumber: 1 }];
  (global.fetch as jest.Mock).mockResolvedValueOnce(response(entries)).mockRejectedValue(new Error('Offline'));
  const fresh = await fetchDubSchedule();
  const saved = await fetchDubSchedule();
  expect(saved.entries).toEqual(entries); expect(saved.cached).toBe(true); expect(saved.updatedAt).toBe(fresh.updatedAt);
  localStorage.setItem('apex_dub_schedule_v1', '{');
  expect((await fetchDubSchedule()).entries).toEqual([]);
});
test('OAuth state is one-use and invalid/expired callbacks fail before token exchange', async () => {
  const state = beginOAuth('mal');
  expect(state).toMatch(/^[a-f0-9]{64}$/);
  validateOAuth('mal', state);
  expect(() => validateOAuth('mal', state)).toThrow();
  const client = new MALClient();
  const url = new URL(client.getAuthorizationUrl());
  expect(url.searchParams.get('code_challenge')).toMatch(/^[a-f0-9]{64}$/);
  expect(await client.authenticate('code', 'wrong')).toBe(false); expect(global.fetch).not.toHaveBeenCalled();
  sessionStorage.setItem('mal_oauth', JSON.stringify({ state: 'expired', createdAt: Date.now() - 700000 }));
  expect(() => validateOAuth('mal', 'expired')).toThrow();
});
test('sync starts all providers and preserves rejected and missing-ID failures', async () => {
  let finish!: (result: import("../types/sync").SyncStatus) => void;
  const first = jest.spyOn(malClient, 'updateAnimeProgress').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const second = jest.spyOn(aniListClient, 'updateAnimeProgress').mockRejectedValue(new Error('AniList offline'));
  const third = jest.spyOn(kitsuClient, 'updateAnimeProgress').mockResolvedValue({ success: true, provider: 'kitsu', episode: 2, timestamp: 1 });
  const settings: SyncSettings = { providers: { mal: { id: 'mal', name: 'MAL', authUrl: '', accessToken: 'connected' }, anilist: { id: 'anilist', name: 'AniList', authUrl: '', accessToken: 'connected' }, kitsu: { id: 'kitsu', name: 'Kitsu', authUrl: '', accessToken: 'connected' } }, autoSync: true, syncOnPlay: false, syncOnPause: true, notifyOnSync: false };
  const manager = new SyncManager(settings);
  const pending = manager.syncEpisodeProgress({ id: 1, title: 'Example', episodes: 12 }, 2, 12, 1, 1, '1');
  await Promise.resolve(); expect(first).toHaveBeenCalled(); expect(second).toHaveBeenCalled(); expect(third).toHaveBeenCalled();
  finish({ success: true, provider: 'mal', episode: 2, timestamp: 1 });
  const results = await pending; expect(results.map(r => r.success)).toEqual([true, false, true]); expect(results[1].error).toContain('offline');
  const missing = await manager.syncEpisodeProgress({ id: 1, title: 'Example', episodes: 12 }, 2, 12);
  expect(missing.every(r => r.error === 'Missing provider anime ID')).toBe(true);
});

test('Kitsu resolves authenticated user ID and avoids writes after library lookup failure', async () => {
  const { KitsuClient } = await import('./sync/kitsuClient');
  const mock = global.fetch as jest.Mock;
  mock.mockResolvedValueOnce(response({ access_token: 'token' })).mockResolvedValueOnce(response({ data: [{ id: '42' }] }));
  const client = new KitsuClient();
  expect(await client.authenticate('email', 'password')).toBe(true);
  expect(mock.mock.calls[0][0]).toBe('https://kitsu.io/api/oauth/token');
  expect(mock.mock.calls[1][0]).toContain('filter[self]=true');
  expect(localStorage.getItem('kitsu_user_id')).toBe('42');
  mock.mockResolvedValueOnce(response({}, 500));
  expect((await client.updateAnimeProgress('1', 2)).success).toBe(false);
  expect(mock).toHaveBeenCalledTimes(3);
});

test('weekly timetable includes every dated dub and never uses Asuna media IDs as AniList IDs', async () => {
  const { timetableEntry, isoWeek } = await import('./dubSchedule');
  const item = {title:'Example',route:'example',episode_date:'2026-10-05T12:00:00Z',episode_number:2,air_type:'dub',media:{mal_id:123}};
  expect(timetableEntry(item)?.media?.media.id).toBe(0);
  expect(timetableEntry(item)?.media?.media.idMal).toBe(123);
  expect(isoWeek(new Date(2026,9,5))).toEqual({year:2026,week:41});
  expect(timetableEntry({...item,air_type:'sub'})).toBeNull();
});
