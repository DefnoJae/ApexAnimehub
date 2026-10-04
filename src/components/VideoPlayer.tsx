import React, { useEffect, useRef, useState } from 'react';
import type { useAccounts } from '../hooks/useAccounts';
interface PlayerProps { title: string; episode: number; stream: { url: string; name: string }; canNext: boolean; onPrevious: () => void; onNext: () => void; onWatched: () => void; onClose: () => void; accounts: ReturnType<typeof useAccounts> }
export function trustedPlaybackMessage(event: MessageEvent, source: Window | null, origin: string): Record<string, unknown> | null {
  if (!source || event.source !== source || event.origin !== origin) return null;
  try { const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; return data && typeof data === 'object' && !Array.isArray(data) ? data : null; } catch { return null; }
}
export function VideoPlayer({ title, episode, stream, canNext, onPrevious, onNext, onWatched, onClose, accounts }: PlayerProps) {
  const frame = useRef<HTMLDivElement>(null), iframe = useRef<HTMLIFrameElement>(null);
  const watched = useRef(false);
  const loaded = useRef(false);
  const restoreFullscreen = useRef(false);
  const restoreTimer = useRef<ReturnType<typeof setTimeout>>();
  const [fullscreen, setFullscreen] = useState(false), [error, setError] = useState('');
  const callbacks = useRef({ onWatched, autoSync: accounts.autoSync, onPrevious, onNext, onClose, canNext, episode });
  callbacks.current = { onWatched, autoSync: accounts.autoSync, onPrevious, onNext, onClose, canNext, episode };
  const origin = new URL(stream.url, window.location.origin).origin;
  const focusShortcuts = () => frame.current?.focus({ preventScroll: true });
  const enterFullscreen = () => { focusShortcuts(); void frame.current?.requestFullscreen().catch(() => setError('Fullscreen is unavailable in this browser.')); };
  useEffect(() => {
    watched.current = false; loaded.current = false; setError('');
    const listener = (event: MessageEvent) => {
      const data = trustedPlaybackMessage(event, iframe.current?.contentWindow || null, origin);
      if (!data || !loaded.current) return;
      if (data.event === 'time' || data.event === 'CURRENT_TIME' || data.type === 'watching-log') {
        const position = Number(data.time ?? data.currentTime), duration = Number(data.duration);
        if (!watched.current && callbacks.current.autoSync && Number.isFinite(position) && Number.isFinite(duration) && duration > 0 && position >= duration * 0.8 && position <= duration + 5) {
          watched.current = true; callbacks.current.onWatched();
        }
      }
      if (data.event === 'error') setError('The video source failed. Close the player and try another source.');
    };
    window.addEventListener('message', listener);
    const poll = setInterval(() => { if (origin !== 'null') iframe.current?.contentWindow?.postMessage({ cmd: 'GET_TIME' }, origin); }, 1000);
    return () => { window.removeEventListener('message', listener); clearInterval(poll); };
  }, [stream.url, origin]);
  useEffect(() => {
    let reclaim: ReturnType<typeof setTimeout> | undefined;
    // Keyboard events cannot cross the provider's iframe. Keep shortcut focus on its host;
    // mouse interaction with the native video controls remains available.
    const blur = () => { reclaim = setTimeout(() => { if (document.activeElement === iframe.current) focusShortcuts(); }, 0); };
    const changed = () => {
      setFullscreen(!!document.fullscreenElement); focusShortcuts();
      // Native iframe fullscreen hides the host and traps keyboard events in the
      // cross-origin document. Promote it immediately while the click is active.
      if (document.fullscreenElement === iframe.current && frame.current?.requestFullscreen) {
        void frame.current.requestFullscreen().then(focusShortcuts).catch(() => setError('Use F or the Fullscreen button above the player to enable episode shortcuts.'));
      }
      if (!document.fullscreenElement && restoreFullscreen.current) { restoreFullscreen.current = false; enterFullscreen(); }
    };
    const navigate = (action: () => void) => {
      restoreFullscreen.current = !!document.fullscreenElement;
      // Promote iframe fullscreen to the persistent host before replacing an episode iframe.
      if (document.fullscreenElement && document.fullscreenElement !== frame.current && frame.current?.requestFullscreen) void frame.current.requestFullscreen().then(action).catch(action);
      else action();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      switch (event.key.toLowerCase()) {
        case 'n': if (callbacks.current.canNext) { event.preventDefault(); navigate(callbacks.current.onNext); } break;
        case 'b': if (callbacks.current.episode > 1) { event.preventDefault(); navigate(callbacks.current.onPrevious); } break;
        case 'f': event.preventDefault(); restoreFullscreen.current = false; if (document.fullscreenElement) void document.exitFullscreen(); else enterFullscreen(); break;
        case 'escape': restoreFullscreen.current = false; if (!document.fullscreenElement) callbacks.current.onClose(); break;
      }
    };
    focusShortcuts();
    window.addEventListener('blur', blur); window.addEventListener('keydown', keyboard);
    document.addEventListener('fullscreenchange', changed);
    return () => { clearTimeout(reclaim); clearTimeout(restoreTimer.current); window.removeEventListener('blur', blur); window.removeEventListener('keydown', keyboard); document.removeEventListener('fullscreenchange', changed); };
  }, []);
  return <div ref={frame} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Anime video player" className="fixed inset-0 z-[500] bg-black text-white flex flex-col outline-none">
    {!fullscreen && <div className="shrink-0 flex items-center gap-4 px-4 py-2 bg-zinc-950 text-sm">
      <span className="truncate flex-1">{title} · Episode {episode} · {stream.name}</span>
      <span className="text-zinc-400">N: Next · B: Previous · F: Fullscreen</span>
      <button onClick={enterFullscreen} aria-label="Fullscreen player">Fullscreen</button>
      <button onClick={onClose} aria-label="Close video player">Close</button>
    </div>}
    {error && <p role="alert" className="shrink-0 px-4 text-amber-300">{error}</p>}
    <iframe ref={iframe} tabIndex={-1} onLoad={() => {
      loaded.current = true; focusShortcuts();
      if (restoreFullscreen.current && !document.fullscreenElement) { restoreFullscreen.current = false; enterFullscreen(); }
      clearTimeout(restoreTimer.current);
      restoreTimer.current = setTimeout(() => { restoreFullscreen.current = false; }, 1000);
    }} title={title + ' episode ' + episode} src={stream.url} className="w-full flex-1 min-h-0 border-none" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
  </div>;
}
