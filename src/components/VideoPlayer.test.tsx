import React from 'react';
import { createRoot } from 'react-dom/client';
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react-dom/test-utils';
import { VideoPlayer, trustedPlaybackMessage } from './VideoPlayer';
import { sendListUpdate, useAccounts } from '../hooks/useAccounts';
const accounts = { busy: false, checking: false, message: '', results: [] } as unknown as ReturnType<typeof useAccounts>;
test('player exposes next and watched actions, preserves source and disables boundaries', () => {
  const node = document.createElement('div'); document.body.appendChild(node);
  const root = createRoot(node);
  const next = jest.fn(), watched = jest.fn();
  const props = { title: 'Example', episode: 1, stream: { name: 'MegaPlay (Dub)', url: 'about:blank' }, canNext: true, onPrevious: jest.fn(), onNext: next, onWatched: watched, onClose: jest.fn(), accounts };
  act(() => { root.render(<VideoPlayer {...props} />); });
  const buttons = Array.from(node.querySelectorAll('button'));
  const volumeIndex = buttons.findIndex(b => b.getAttribute('aria-label') === 'Mute video');
  expect(buttons[volumeIndex + 1].getAttribute('aria-label')).toBe('Next episode');
  expect(node.textContent).toContain('MegaPlay (Dub)');
  act(() => { buttons.find(b => b.getAttribute('aria-label') === 'Next episode')?.click(); buttons.find(b => b.getAttribute('aria-label') === 'Mark episode watched')?.click(); });
  expect(next).toHaveBeenCalledTimes(1); expect(watched).toHaveBeenCalledTimes(1);
  act(() => { root.render(<VideoPlayer {...props} episode={12} canNext={false} />); });
  expect(node.querySelector<HTMLButtonElement>('[aria-label="Next episode"]')?.disabled).toBe(true);
  act(() => { root.unmount(); }); node.remove();
});
test('MAL uses confirmed idMal, exposes server errors, and refuses unmapped IDs', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  const anime = { id: 16498, idMal: 1001 };
  expect((await sendListUpdate('mal', anime, 'planning')).success).toBe(true);
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ id: 1001, status: 'planning', automatic: false });
  (global.fetch as jest.Mock).mockClear();
  expect((await sendListUpdate('mal', { id: 1 }, 'dropped')).error).toContain('confirmed MyAnimeList ID');
  expect(global.fetch).not.toHaveBeenCalled();
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ error: 'Please reconnect' }) });
  expect((await sendListUpdate('anilist', anime, 'watching', 3)).error).toBe('Please reconnect');
});

test('only playback messages from the current iframe origin and window are trusted', () => {
  const source = window;
  expect(trustedPlaybackMessage(new MessageEvent('message',{origin:'https://attacker.example',source,data:{event:'complete'}}),source,'https://megaplay.buzz')).toBeNull();
  expect(trustedPlaybackMessage(new MessageEvent('message',{origin:'https://megaplay.buzz',source,data:'{"event":"complete"}'}),source,'https://megaplay.buzz')).toEqual({event:'complete'});
  expect(trustedPlaybackMessage(new MessageEvent('message',{origin:'https://megaplay.buzz',data:{event:'complete'}}),source,'https://megaplay.buzz')).toBeNull();
});
