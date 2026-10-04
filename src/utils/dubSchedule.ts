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
