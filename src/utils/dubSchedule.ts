import type { DubEntry } from '../types/schedule';
export interface ScheduleResult { entries: DubEntry[]; updatedAt: number | null; cached: boolean; error?: string }
const KEY = 'apex_dub_schedule_v1';
export function validSchedule(value: unknown): value is DubEntry[] {
  return Array.isArray(value) && value.every(e => e && typeof e.title === 'string' && typeof e.episodeDate === 'string' && Number.isFinite(Date.parse(e.episodeDate)) && typeof e.episodeNumber === 'number');
}
export async function fetchDubSchedule(): Promise<ScheduleResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://raw.githubusercontent.com/RockinChaos/AniSchedule/master/raw/dub-schedule.json', { signal: controller.signal });
    if (!response.ok) throw new Error('Schedule request failed (' + response.status + ')');
    const entries: unknown = await response.json();
    if (!validSchedule(entries)) throw new Error('Schedule data format is invalid');
    const result = { entries, updatedAt: Date.now(), cached: false };
    try { localStorage.setItem(KEY, JSON.stringify(result)); } catch { /* Storage may be unavailable or full. */ }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Schedule unavailable';
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && validSchedule(saved.entries) && Number.isFinite(saved.updatedAt)) return { ...saved, cached: true, error: message };
    } catch { /* Ignore corrupt cache. */ }
    return { entries: [], updatedAt: null, cached: false, error: message };
  } finally { clearTimeout(timer); }
}

export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  return { year, week: Math.ceil((((d.getTime() - Date.UTC(year, 0, 1)) / 86400000) + 1) / 7) };
}
interface TimetableItem { title: string; title_english?: string; route: string; episode_date: string; episode_number: number; air_type: string; image_url?: string; mal_id?: number; external_ids?: { anilist?: number }; delayed_text?: string; media?: { mal_id?: number; external_ids?: { anilist?: number }; image_url?: string } }
export function timetableEntry(item: TimetableItem): DubEntry | null {
  if (item.air_type !== 'dub' || !item.title || !Number.isFinite(Date.parse(item.episode_date)) || !Number.isFinite(item.episode_number)) return null;
  return { title: item.title, route: item.route, native: '', episodeDate: item.episode_date, episodeNumber: item.episode_number, delayedFrom: '', delayedUntil: '', airingStatus: item.delayed_text || '', verified: false,
    media: { media: { id: item.external_ids?.anilist || item.media?.external_ids?.anilist || 0, idMal: item.mal_id || item.media?.mal_id, title: { english: item.title_english || item.title, romaji: item.title }, coverImage: { extraLarge: item.image_url || item.media?.image_url || '' }, description: '', episodes: 0, averageScore: 0, airingSchedule: { nodes: [] } } } };
}
export async function fetchDubRange(start: Date, end: Date, force = false): Promise<ScheduleResult> {
  const weeks = new Map<string, { year: number; week: number }>();
  const day = new Date(start); day.setHours(0, 0, 0, 0);
  while (day <= end) { const week = isoWeek(day); weeks.set(week.year + '-' + week.week, week); day.setDate(day.getDate() + 1); }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const entries: DubEntry[] = []; const errors: string[] = []; let cached = false, updatedAt = Date.now();
  // Request only the displayed weeks. Per-week caches retain historical and future pages.
  for (const [key, week] of Array.from(weeks.entries())) {
    const cacheKey = 'apex_timetable_' + key + '_' + timezone;
    let saved: { entries: DubEntry[]; updatedAt: number } | null = null;
    try { saved = JSON.parse(localStorage.getItem(cacheKey) || 'null'); if (saved && (!validSchedule(saved.entries) || !Number.isFinite(saved.updatedAt))) saved = null; } catch { }
    if (!force && saved && Date.now() - saved.updatedAt < 600000) { entries.push(...saved.entries); updatedAt = Math.min(updatedAt, saved.updatedAt); continue; }
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const query = new URLSearchParams({ type: 'dub', year: String(week.year), week: String(week.week), tz: timezone });
      const response = await fetch('https://asunatracks.space/public/api/anime-schedule?' + query, { signal: controller.signal });
      if (!response.ok) throw new Error('Timetable request failed (' + response.status + ')');
      const data: { configured: boolean; items: TimetableItem[]; stale?: boolean; warning?: string } = await response.json();
      if (!data.configured || !Array.isArray(data.items)) throw new Error('Dub timetable unavailable');
      const next = data.items.map(timetableEntry).filter((entry): entry is DubEntry => !!entry);
      entries.push(...next); if (data.stale) { cached = true; errors.push(data.warning || 'Source timetable is stale'); }
      if (!data.stale) { try { localStorage.setItem(cacheKey, JSON.stringify({ entries: next, updatedAt: Date.now() })); } catch { } }
    } catch (error) { if (saved) { entries.push(...saved.entries); cached = true; updatedAt = Math.min(updatedAt, saved.updatedAt); } errors.push('Week ' + week.week + ': ' + (error instanceof Error ? error.message : 'unavailable')); }
    finally { clearTimeout(timer); }
  }
  const unique = new Map(entries.map(entry => [entry.route + ':' + entry.episodeDate + ':' + entry.episodeNumber, entry]));
  return { entries: Array.from(unique.values()), updatedAt: entries.length ? updatedAt : null, cached, error: errors.length ? errors.join('; ') : undefined };
}
