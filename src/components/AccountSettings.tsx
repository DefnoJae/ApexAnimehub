import React from 'react';
import type { useAccounts } from '../hooks/useAccounts';
export function AccountSettings({ accounts, onClose }: { accounts: ReturnType<typeof useAccounts>; onClose: () => void }) {
  return <div role="dialog" aria-modal="true" aria-label="Account settings" className="fixed inset-0 z-[600] bg-black/80 flex items-center justify-center p-4">
    <div className="bg-[#151515] border border-purple-500/30 rounded-3xl p-8 w-full max-w-lg text-white">
      <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">Account settings</h2><button onClick={onClose} aria-label="Close account settings">✕</button></div>
      <p className="text-slate-400 mb-6">Connect your accounts to update your lists from anime details and the player.</p>
      {(['anilist', 'mal'] as const).map(provider => <div key={provider} className="flex justify-between items-center gap-4 py-4 border-b border-white/10">
        <div><p>{provider === 'mal' ? 'MyAnimeList' : 'AniList'}</p><p className="text-sm text-slate-400">{accounts.checking ? 'Checking…' : accounts.connected[provider] ? 'Connected' : 'Disconnected'}</p></div>
        {accounts.connected[provider] ? <button disabled={accounts.busy} onClick={() => void accounts.disconnect(provider)} className="text-purple-300 disabled:opacity-50">Disconnect</button> : <a className="bg-purple-600 px-4 py-2 rounded-xl" href={'/api/oauth/' + provider + '/start'}>Connect</a>}
      </div>)}
      <label className="flex gap-3 items-start my-6"><input type="checkbox" checked={accounts.autoSync} onChange={accounts.toggleAutoSync} /><span>Sync watching automatically<p className="text-sm text-slate-400 mt-1">Play marks Watching. Next episode records the episode you just finished. Use Mark watched for the final episode.</p></span></label>
      {accounts.loginNotice && <p role="status" className="text-purple-300 mb-4">{accounts.loginNotice}</p>}
      {accounts.accountError && <p role="alert" className="text-amber-300 mb-4">{accounts.accountError}</p>}
      <button className="text-purple-300 underline" onClick={() => void accounts.refresh()}>Refresh connections</button>
    </div>
  </div>;
}
