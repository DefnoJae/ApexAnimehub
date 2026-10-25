const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
process.env.SESSION_SECRET = 'test-only-random-secret-never-use-in-production';
const { handler, seal, open } = require('./vercel.cjs');
const { sessions } = require('./oauth.cjs');
test('encrypted account cookies survive empty Vercel instances and reject tampering', async () => {
  const session = { accounts: { mal: { accessToken: 'private-token', expiresAt: Date.now() + 3600000 } }, pending: {}, expiresAt: Date.now() + 3600000 };
  const cookie = seal(session); assert.ok(!cookie.includes('private-token')); assert.deepEqual(open(cookie), session); assert.equal(open(cookie.slice(0,-5)+'abcde'), null);
  const server = http.createServer(handler); await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    const url = 'http://127.0.0.1:' + server.address().port;
    sessions.clear();
    const response = await fetch(url + '/api/oauth/mal/session', { headers: { Cookie: 'apex_auth_0=' + cookie } });
    assert.deepEqual(await response.json(), { authenticated: true }); assert.equal(sessions.size,0);
    const logout = await fetch(url + '/api/oauth/mal/logout', { method:'POST', headers: { Cookie: 'apex_auth_0=' + cookie, Origin:'http://localhost:3000' } });
    assert.equal(logout.status,200); const saved = logout.headers.getSetCookie().find(c=>c.startsWith('apex_auth_0=')).split(';')[0].split('=')[1]; assert.equal(open(saved).accounts.mal, undefined);
  } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
});
