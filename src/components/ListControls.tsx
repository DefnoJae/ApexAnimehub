import React, { useState } from 'react';
import type { ListAnime, ListStatus, useAccounts } from '../hooks/useAccounts';
export function ListFeedback({ accounts }: { accounts: ReturnType<typeof useAccounts> }) {
  return <div role="status" aria-live="polite" className="text-sm text-slate-300">
    {accounts.busy && <p>Updating your lists…</p>}
    {accounts.message && <p>{accounts.message}</p>}
    {accounts.results.map(result => <p key={result.provider} className={result.success ? 'text-purple-300' : 'text-amber-300'}>{result.provider === 'mal' ? 'MyAnimeList' : 'AniList'}: {result.success ? 'Updated' : result.error}</p>)}
  </div>;
}
export function ListControls({ anime, accounts, onConnect }: { anime: ListAnime; accounts: ReturnType<typeof useAccounts>; onConnect: () => void }) {
  const [status, setStatus] = useState<ListStatus>('planning');
  return <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
    <h3 className="font-bold">My anime lists</h3>
    <div className="flex flex-wrap gap-3 items-center"><label className="sr-only" htmlFor="list-status">List status</label>
      <select id="list-status" value={status} onChange={event => setStatus(event.target.value as ListStatus)} className="bg-slate-900 rounded-xl p-3">
        <option value="planning">Planning</option><option value="watching">Watching</option><option value="completed">Completed</option><option value="paused">On hold</option><option value="dropped">Dropped</option>
      </select>
      <button disabled={accounts.busy || accounts.checking} onClick={() => void accounts.sync(anime, status, status === 'completed' && anime.episodes ? anime.episodes : undefined)} className="bg-purple-600 rounded-xl px-5 py-3 disabled:opacity-50">Save to connected lists</button>
      <button className="text-purple-300 underline" onClick={onConnect}>Manage accounts</button>
    </div><ListFeedback accounts={accounts} />
  </div>;
}
