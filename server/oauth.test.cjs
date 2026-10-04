const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer, sessions } = require('./oauth.cjs');
test('OAuth rejects forged state, cross-origin writes and unauthenticated requests', async () => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/api/oauth/anilist/callback?code=x&state=forged')).status, 400);
    assert.equal((await fetch(base + '/api/oauth/anilist/graphql', { method: 'POST', headers: { Origin: 'https://attacker.example' }, body: '{}' })).status, 403);
    assert.equal((await fetch(base + '/api/oauth/anilist/session')).status, 401);
    process.env.ANILIST_CLIENT_ID = 'test'; process.env.ANILIST_CLIENT_SECRET = 'server-only'; process.env.ANILIST_REDIRECT_URI = 'http://localhost:3000/api/oauth/anilist/callback';
    const start = await fetch(base + '/api/oauth/anilist/start', { redirect: 'manual' });
    const cookie = start.headers.get('set-cookie'); assert.match(cookie, /HttpOnly; SameSite=Lax/);
    const state = new URL(start.headers.get('location')).searchParams.get('state'); assert.equal(state.length, 64);
    const callback = await fetch(base + '/api/oauth/anilist/callback?error=access_denied&state=' + state, { headers: { Cookie: cookie.split(';')[0] } });
    assert.equal(callback.status, 400); assert.equal(sessions.size, 0);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); sessions.clear(); }
});
