const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer, sessions } = require('./oauth.cjs');
const { updateList, validateUpdate } = require('./list.cjs');
const browserFetch = global.fetch;
const json = data => ({ ok: true, status: 200, json: async () => data });
const origin = 'http://localhost:3000';
async function serve(run) {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run('http://127.0.0.1:' + server.address().port); }
  finally { global.fetch = browserFetch; sessions.clear(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test('OAuth rejects forged state and cross-origin writes; denial consumes state', () => serve(async base => {
  assert.equal((await browserFetch(base + '/api/oauth/anilist/callback?code=x&state=forged')).status, 400);
  assert.equal((await browserFetch(base + '/api/list/mal', { method: 'POST', headers: { Origin: 'https://attacker.example' }, body: '{}' })).status, 403);
  assert.equal((await browserFetch(base + '/api/oauth/anilist/session')).status, 401);
  process.env.ANILIST_CLIENT_ID = 'test'; process.env.ANILIST_CLIENT_SECRET = 'server-only'; process.env.ANILIST_REDIRECT_URI = origin + '/api/oauth/anilist/callback';
  const start = await browserFetch(base + '/api/oauth/anilist/start', { redirect: 'manual' });
  const cookie = start.headers.get('set-cookie'); assert.match(cookie, /HttpOnly; SameSite=Lax/);
  const state = new URL(start.headers.get('location')).searchParams.get('state'); assert.equal(state.length, 64);
  const callbackURL = base + '/api/oauth/anilist/callback?error=access_denied&state=' + state;
  const headers = { Cookie: cookie.split(';')[0] };
  const denied = await browserFetch(callbackURL, { headers, redirect: 'manual' });
  assert.equal(denied.status, 302); assert.match(denied.headers.get('location'), /result=denied/);
  assert.equal((await browserFetch(callbackURL, { headers, redirect: 'manual' })).status, 400);
}));
test('connect both accounts, keep tokens server-side, sync lists and disconnect independently', () => serve(async base => {
  process.env.MAL_CLIENT_ID = 'mal-client'; process.env.MAL_REDIRECT_URI = origin + '/api/oauth/mal/callback';
  let cookie = '', calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/oauth') && url.endsWith('/token')) return json({ access_token: 'secret-access', refresh_token: 'secret-refresh', expires_in: 3600 });
    if (url.includes('graphql')) {
      const input = JSON.parse(options.body);
      return json({ data: input.query.startsWith('mutation') ? { SaveMediaListEntry: { id: 1, status: input.variables.status, progress: input.variables.progress } } : { Media: { mediaListEntry: { progress: 7, status: 'CURRENT' } } } });
    }
    if (options.method === 'PATCH') return json({ status: 'watching', num_episodes_watched: 7 });
    return json({ my_list_status: { num_episodes_watched: 7, status: 'watching' } });
  };
  for (const provider of ['anilist', 'mal']) {
    const start = await browserFetch(base + '/api/oauth/' + provider + '/start', { headers: { Cookie: cookie }, redirect: 'manual' });
    cookie = start.headers.get('set-cookie').split(';')[0];
    const authorization = new URL(start.headers.get('location'));
    if (provider === 'mal') { assert.equal(authorization.searchParams.get('code_challenge').length, 64); assert.equal(authorization.searchParams.get('code_challenge_method'), 'plain'); }
    const callback = await browserFetch(base + '/api/oauth/' + provider + '/callback?code=test&state=' + authorization.searchParams.get('state'), { headers: { Cookie: cookie }, redirect: 'manual' });
    assert.equal(callback.status, 302); cookie = callback.headers.get('set-cookie').split(';')[0]; assert.ok(!cookie.includes('secret-access'));
  }
  for (const provider of ['anilist', 'mal']) {
    const session = await browserFetch(base + '/api/oauth/' + provider + '/session', { headers: { Cookie: cookie } });
    assert.deepEqual(await session.json(), { authenticated: true });
    const update = await browserFetch(base + '/api/list/' + provider, { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 1, status: 'watching', progress: 2, automatic: true }) });
    assert.equal(update.status, 200);
  }
  const malPatch = calls.find(c => c.options.method === 'PATCH'); assert.equal(new URLSearchParams(malPatch.options.body).get('num_watched_episodes'), '7');
  const mutation = calls.filter(c => c.url.includes('graphql')).map(c => JSON.parse(c.options.body)).find(c => c.query.startsWith('mutation')); assert.equal(mutation.variables.progress, 7);
  await browserFetch(base + '/api/oauth/mal/logout', { method: 'POST', headers: { Cookie: cookie, Origin: origin } });
  assert.equal((await browserFetch(base + '/api/oauth/mal/session', { headers: { Cookie: cookie } })).status, 401);
  assert.equal((await browserFetch(base + '/api/oauth/anilist/session', { headers: { Cookie: cookie } })).status, 200);
}));
test('list mappings preserve progress on status changes and reject invalid input', async () => {
  assert.throws(() => validateUpdate({ id: 1, status: 'toString' }));
  assert.throws(() => validateUpdate({ id: 1, status: 'watching', progress: -1 }));
  const calls = [];
  global.fetch = async (url, options) => { calls.push(options); return json({ data: { SaveMediaListEntry: { id: 1 } } }); };
  try {
    for (const [status, expected] of [['planning', 'PLANNING'], ['paused', 'PAUSED'], ['dropped', 'DROPPED'], ['completed', 'COMPLETED']]) {
      await updateList('anilist', { accessToken: 'token' }, { id: 1, status });
      const input = JSON.parse(calls.at(-1).body); assert.equal(input.variables.status, expected); assert.equal('progress' in input.variables, false);
    }
  } finally { global.fetch = browserFetch; }
});
