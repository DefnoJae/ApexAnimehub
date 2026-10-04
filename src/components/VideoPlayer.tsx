import React, { useEffect, useRef, useState } from 'react';
import { SkipForward, X, Maximize, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import type { useAccounts } from '../hooks/useAccounts';
interface PlayerProps { title: string; episode: number; stream: { url: string; name: string }; canNext: boolean; onPrevious: () => void; onNext: () => void; onWatched: () => void; onClose: () => void; accounts: ReturnType<typeof useAccounts> }
export function trustedPlaybackMessage(event: MessageEvent, source: Window | null, origin: string): Record<string, unknown> | null {
  if (!source || event.source !== source || event.origin !== origin) return null;
  try { const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; return data && typeof data === 'object' && !Array.isArray(data) ? data : null; } catch { return null; }
}
const timeLabel = (value: number) => Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
export function VideoPlayer({ title, episode, stream, canNext, onNext, onWatched, onClose, accounts }: PlayerProps) {
  const frame = useRef<HTMLDivElement>(null), iframe = useRef<HTMLIFrameElement>(null);
  const watched = useRef(false);
  const [visible, setVisible] = useState(true), [ready, setReady] = useState(false), [muted, setMuted] = useState(false), [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0), [duration, setDuration] = useState(0), [error, setError] = useState('');
  const idle = useRef<ReturnType<typeof setTimeout>>();
  const callbacks = useRef({ onWatched, autoSync: accounts.autoSync }); callbacks.current = { onWatched, autoSync: accounts.autoSync };
  const origin = new URL(stream.url, window.location.origin).origin;
  const command = (cmd: string, value?: number) => iframe.current?.contentWindow?.postMessage({ cmd, ...(value !== undefined ? { value } : {}) }, origin);
  const wake = () => { setVisible(true); clearTimeout(idle.current); idle.current = setTimeout(() => setVisible(false), 3000); };
  useEffect(() => {
    watched.current = false; setReady(false); setPosition(0); setDuration(0); setError(''); setMuted(false); setPlaying(false);
    const listener = (event: MessageEvent) => {
      const data = trustedPlaybackMessage(event, iframe.current?.contentWindow || null, origin);
      if (!data) return;
      if (data.event === 'PLAYER_READY') setReady(true);
      if (data.event === 'time' || data.event === 'CURRENT_TIME' || data.type === 'watching-log') {
        const time = Number(data.time ?? data.currentTime), length = Number(data.duration);
        if (Number.isFinite(time) && time >= 0) setPosition(time);
        if (Number.isFinite(length) && length > 0) { setDuration(length); setReady(true); }
      }
      if (data.event === 'time' || data.type === 'watching-log') setPlaying(true);
      if (data.event === 'complete' && !watched.current && callbacks.current.autoSync) { watched.current = true; callbacks.current.onWatched(); }
      if (data.event === 'error') setError('The video source failed. Close the player and try another source.');
    };
    window.addEventListener('message', listener);
    const poll = setInterval(() => command('GET_TIME'), 1000);
    return () => { window.removeEventListener('message', listener); clearInterval(poll); clearTimeout(idle.current); };
  }, [stream.url, origin]);
  const fullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await frame.current?.requestFullscreen(); } catch { setError('Fullscreen is unavailable in this browser.'); } };
  return <div ref={frame} role="dialog" aria-modal="true" aria-label="Anime video player" onPointerMove={wake} onPointerDown={wake} onFocusCapture={wake} className="fixed inset-0 z-[500] bg-black text-white">
    <iframe ref={iframe} key={stream.url} title={title + ' episode ' + episode} src={stream.url} className="absolute inset-0 w-full h-full border-none" allow="autoplay; encrypted-media" />
    <div className={'absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between pointer-events-none transition-opacity ' + (visible ? 'opacity-100' : 'opacity-0')}>
      <div><h2 className="font-bold">{title}</h2><p className="text-sm text-purple-300">Episode {episode} · {stream.name}</p></div>
      <button aria-label="Close video player" onClick={onClose} className="pointer-events-auto p-2"><X size={24} /></button>
    </div>
    <div className={'absolute bottom-0 inset-x-0 px-4 pt-10 pb-3 bg-gradient-to-t from-black via-black/90 to-transparent transition-opacity ' + (visible ? 'opacity-100' : 'opacity-0')} onPointerEnter={() => { clearTimeout(idle.current); setVisible(true); }}>
      {duration > 0 && <input aria-label="Seek video" type="range" min={0} max={duration} step={1} value={Math.min(position, duration)} onChange={event => { const time = Number(event.target.value); setPosition(time); command('SEEK', time); }} className="w-full accent-purple-500 h-1 mb-3" />}
      <div className="flex items-center gap-3">
        <button aria-label={playing ? 'Pause video' : 'Play video'} disabled={!ready} onClick={() => { command('PLAY_TOGGLE'); setPlaying(!playing); }} className="p-2 disabled:opacity-40">{playing ? <Pause size={22} /> : <Play size={22} />}</button>
        <button aria-label={muted ? 'Unmute video' : 'Mute video'} disabled={!ready} onClick={() => { command('MUTE'); setMuted(!muted); }} className="p-2 disabled:opacity-40">{muted ? <VolumeX size={22} /> : <Volume2 size={22} />}</button>
        <button aria-label="Next episode" title="Next episode" disabled={!canNext} onClick={onNext} className="p-2 hover:text-purple-300 disabled:opacity-30"><SkipForward size={22} /></button>
        <span className="text-xs text-slate-300">{timeLabel(position)}{duration > 0 ? ' / ' + timeLabel(duration) : ''}</span>
        <div className="flex-1" />
        <button aria-label="Mark episode watched" title="Mark episode watched" disabled={accounts.busy || accounts.checking} onClick={onWatched} className="text-xs text-slate-300 disabled:opacity-30">Watched</button>
        <button aria-label="Fullscreen player" onClick={() => void fullscreen()} className="p-2"><Maximize size={22} /></button>
      </div>
      {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
    </div>
  </div>;
}
