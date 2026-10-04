import React from 'react';
import { createRoot } from 'react-dom/client';
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react-dom/test-utils';
import { VideoPlayer, trustedPlaybackMessage } from './VideoPlayer';
import { sendListUpdate, useAccounts } from '../hooks/useAccounts';
const accounts = { busy: false, checking: false, message: '', results: [] } as unknown as ReturnType<typeof useAccounts>;
test('native player has no playback overlay; N/B navigate with boundaries and preserve iframe permissions', () => {
  const node = document.createElement('div'); document.body.appendChild(node); const root = createRoot(node);
  const next = jest.fn(), previous = jest.fn(), watched = jest.fn();
  const props = { title: 'Example', episode: 2, stream: { name: 'MegaPlay (Dub)', url: 'https://megaplay.buzz/stream/ani/1/2/dub' }, canNext: true, onPrevious: previous, onNext: next, onWatched: watched, onClose: jest.fn(), accounts };
  act(() => { root.render(<VideoPlayer {...props} />); });
  expect(node.querySelector('[aria-label="Mute video"]')).toBeNull(); expect(node.querySelector('[aria-label="Seek video"]')).toBeNull();
  expect(node.querySelector('iframe')?.hasAttribute('allowfullscreen')).toBe(true);
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown',{key:'N'})); window.dispatchEvent(new KeyboardEvent('keydown',{key:'b'})); });
  expect(next).toHaveBeenCalledTimes(1); expect(previous).toHaveBeenCalledTimes(1); expect(watched).not.toHaveBeenCalled();
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown',{key:'n',repeat:true})); root.render(<VideoPlayer {...props} episode={1} canNext={false} />); });
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown',{key:'n'})); window.dispatchEvent(new KeyboardEvent('keydown',{key:'b'})); });
  expect(next).toHaveBeenCalledTimes(1); expect(previous).toHaveBeenCalledTimes(1);
  act(() => root.unmount()); node.remove();
});
test('only trusted playback at 80% records the episode once, with reset for a new episode', () => {
  const node = document.createElement('div'); document.body.appendChild(node); const root = createRoot(node); const watched = jest.fn();
  const props = { title:'Example', episode:1, stream:{name:'MegaPlay (Sub)',url:'https://megaplay.buzz/stream/ani/1/1/sub'},canNext:true,onPrevious:jest.fn(),onNext:jest.fn(),onWatched:watched,onClose:jest.fn(),accounts:{...accounts,autoSync:true} };
  act(()=>root.render(<VideoPlayer {...props}/>));
  const load = () => act(()=>{ node.querySelector('iframe')!.dispatchEvent(new Event('load')); }); load();
  const send = (data: Record<string,unknown>, origin='https://megaplay.buzz') => act(()=>{ window.dispatchEvent(new MessageEvent('message',{origin,source:node.querySelector('iframe')!.contentWindow,data})); });
  send({event:'CURRENT_TIME',time:79,duration:100}); send({event:'complete'}); send({event:'CURRENT_TIME',time:80,duration:100},'https://attacker.example');
  expect(watched).not.toHaveBeenCalled();
  send({event:'CURRENT_TIME',time:80,duration:100}); send({event:'time',time:99,duration:100}); expect(watched).toHaveBeenCalledTimes(1);
  act(()=>root.render(<VideoPlayer {...props} episode={2} stream={{...props.stream,url:'https://megaplay.buzz/stream/ani/1/2/sub'}}/>));
  load(); send({type:'watching-log',currentTime:80,duration:100}); expect(watched).toHaveBeenCalledTimes(2);
  act(()=>root.render(<VideoPlayer {...props} accounts={{...props.accounts,autoSync:false}}/>));
  send({event:'CURRENT_TIME',time:90,duration:100}); expect(watched).toHaveBeenCalledTimes(2);
  act(()=>root.unmount()); node.remove();
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
