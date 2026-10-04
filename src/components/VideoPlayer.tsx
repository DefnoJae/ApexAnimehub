import React, { useRef, useState } from 'react';
import { SkipBack, SkipForward, X, Maximize } from 'lucide-react';
import { ListFeedback } from './ListControls';
import type { useAccounts } from '../hooks/useAccounts';
interface PlayerProps { title: string; episode: number; stream: { url: string; name: string }; canNext: boolean; onPrevious: () => void; onNext: () => void; onWatched: () => void; onClose: () => void; accounts: ReturnType<typeof useAccounts> }
export function VideoPlayer({ title, episode, stream, canNext, onPrevious, onNext, onWatched, onClose, accounts }: PlayerProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [fullscreenError, setFullscreenError] = useState('');
  const fullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await frame.current?.requestFullscreen(); } catch { setFullscreenError('Fullscreen is unavailable in this browser.'); } };
  return <div ref={frame} role="dialog" aria-modal="true" aria-label="Anime video player" className="fixed inset-0 z-[500] bg-black flex flex-col">
    <div className="flex justify-between items-center gap-4 px-4 py-3 bg-[#151515] shrink-0"><div><h2 className="font-bold">{title}</h2><p className="text-purple-300 text-sm">Episode {episode} · {stream.name}</p></div>
      <div className="flex gap-4"><button aria-label="Fullscreen player" onClick={() => void fullscreen()}><Maximize size={22} /></button><button aria-label="Close video player" onClick={onClose}><X size={24} /></button></div>
    </div>
    <iframe key={stream.url} title={title + ' episode ' + episode} src={stream.url} className="flex-1 w-full min-h-0 border-none" allow="autoplay; encrypted-media" />
    <div className="bg-[#151515] px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-3"><button disabled={episode <= 1} onClick={onPrevious} className="px-4 py-3 rounded-xl bg-white/10 disabled:opacity-40 flex items-center gap-2"><SkipBack size={18} />Previous</button>
        <button disabled={accounts.busy || accounts.checking} onClick={onWatched} className="px-4 py-3 rounded-xl bg-white/10 disabled:opacity-40">Mark episode {episode} watched</button>
        <button disabled={!canNext} onClick={onNext} className="px-4 py-3 rounded-xl bg-purple-600 disabled:opacity-40 flex items-center gap-2">Next episode<SkipForward size={18} /></button>
      </div><ListFeedback accounts={accounts} />
      {fullscreenError && <p role="alert">{fullscreenError}</p>}
    </div>
  </div>;
}
