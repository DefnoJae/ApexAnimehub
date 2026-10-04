import { fetchAnilist } from '../utils/anilist';
import { useCallback, useEffect, useRef, useState } from 'react';
export type AccountProvider = 'anilist' | 'mal';
export type ListStatus = 'watching' | 'planning' | 'completed' | 'paused' | 'dropped';
export interface ListAnime { id: number; idMal?: number | null; episodes?: number | null; title?: { english?: string; romaji?: string } }
export interface AccountResult { provider: AccountProvider; success: boolean; error?: string }
const providers: AccountProvider[] = ['anilist', 'mal'];
export async function sendListUpdate(provider: AccountProvider, anime: ListAnime, status: ListStatus, progress?: number, automatic = false): Promise<AccountResult> {
  try {
    if (provider === 'mal' && !anime.idMal) throw new Error('This anime has no confirmed MyAnimeList ID. Reopen its details and try again.');
    const response = await fetch('/api/list/' + provider, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: provider === 'mal' ? anime.idMal : anime.id, status, ...(progress !== undefined ? { progress } : {}), automatic }) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'List update failed (' + response.status + ')');
    return { provider, success: true };
  } catch (error) { return { provider, success: false, error: error instanceof Error ? error.message : 'List update failed' }; }
}
export function useAccounts() {
  const [connected, setConnected] = useState<Record<AccountProvider, boolean>>({ anilist: false, mal: false });
  const [checking, setChecking] = useState(true);
  const [accountError, setAccountError] = useState('');
  const [loginNotice] = useState(() => {
    const result = new URLSearchParams(window.location.search).get('result');
    return result === 'connected' ? 'Account connected.' : result === 'denied' ? 'Connection cancelled. You can try again.' : result === 'failed' ? 'Account connection failed. Please try again.' : '';
  });
  const [autoSync, setAutoSync] = useState(() => { try { return localStorage.getItem('apex_auto_sync') !== 'false'; } catch { return true; } });
  const [results, setResults] = useState<AccountResult[]>([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const refresh = useCallback(async () => {
    setChecking(true); setAccountError('');
    const checks = await Promise.allSettled(providers.map(async provider => {
      const response = await fetch('/api/oauth/' + provider + '/session');
      if (!response.ok && response.status !== 401) throw new Error('Account service unavailable. Please try again.');
      const data = await response.json(); return !!data.authenticated;
    }));
    setConnected({ anilist: checks[0].status === 'fulfilled' && checks[0].value, mal: checks[1].status === 'fulfilled' && checks[1].value });
    if (checks.some(r => r.status === 'rejected')) setAccountError('Could not check account connections. The account service may be unavailable.');
    setChecking(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const toggleAutoSync = () => setAutoSync(value => { try { localStorage.setItem('apex_auto_sync', String(!value)); } catch {} return !value; });
  const disconnect = async (provider: AccountProvider) => {
    try {
      const response = await fetch('/api/oauth/' + provider + '/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Could not disconnect account');
      setConnected(value => ({ ...value, [provider]: false }));
    } catch (error) { setAccountError(error instanceof Error ? error.message : 'Disconnect failed'); }
  };
  const sync = (anime: ListAnime, status: ListStatus, progress?: number, automatic = false) => {
    if (automatic && !autoSync) return Promise.resolve([]);
    const enabled = providers.filter(provider => connected[provider]);
    if (!enabled.length) { if (!automatic) { setResults([]); setMessage('Connect AniList or MyAnimeList in Settings first.'); } return Promise.resolve([]); }
    setPending(value => value + 1);
    const task = queue.current.catch(() => {}).then(async () => {
      let mapped = anime;
      if (enabled.includes('mal') && !mapped.idMal) {
        try {
          const data = await fetchAnilist<{ Media: ListAnime }>('query($id:Int){Media(id:$id,type:ANIME){id idMal episodes title{english romaji}}}', { id: anime.id });
          if (data.Media) mapped = data.Media;
        } catch { /* AniList updates still proceed if MAL mapping lookup fails. */ }
      }
      const effectiveStatus = status === 'watching' && progress !== undefined && mapped.episodes && progress >= mapped.episodes ? 'completed' : status;
      const settled = await Promise.allSettled(enabled.map(provider => sendListUpdate(provider, mapped, effectiveStatus, progress, automatic)));
      const next = settled.map((result, i): AccountResult => result.status === 'fulfilled' ? result.value : { provider: enabled[i], success: false, error: String(result.reason) });
      setResults(next); setMessage((anime.title?.english || anime.title?.romaji || 'Anime') + ': ' + effectiveStatus + (progress !== undefined ? ' · watched through episode ' + progress : ''));
      return next;
    }).finally(() => setPending(value => value - 1));
    queue.current = task;
    return task;
  };
  return { connected, checking, accountError, loginNotice, autoSync, toggleAutoSync, refresh, disconnect, sync, results, message, busy: pending > 0 };
}
