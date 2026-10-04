// Same-origin OAuth backend. Tokens and secrets never enter browser storage.
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const origin = process.env.APP_ORIGIN || 'http://localhost:3000';
const secure = origin.startsWith('https:');
const sessions = new Map();
const token = () => randomBytes(32).toString('hex');
function cookie(res, id, age = 3600) {
  res.setHeader('Set-Cookie', 'apex_session=' + id + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + age + (secure ? '; Secure' : ''));
}
async function body(req) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > 32768) throw new Error('Request too large'); }
  return JSON.parse(data);
}
function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const url = new URL(req.url, origin);
    const id = /(?:^|; )apex_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    const session = sessions.get(id);
    if (session && session.expiresAt < Date.now()) sessions.delete(id);
    const current = sessions.get(id);
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      if (req.method === 'POST' && req.headers.origin !== origin) return send(403, { error: 'Invalid origin' });
      if (url.pathname === '/api/oauth/anilist/start' && req.method === 'GET') {
        const clientId = process.env.ANILIST_CLIENT_ID;
        const redirect = process.env.ANILIST_REDIRECT_URI;
        if (!clientId || !redirect || !process.env.ANILIST_CLIENT_SECRET) return send(503, { error: 'AniList OAuth server is not configured' });
        const nextId = token(), state = token();
        if (id) sessions.delete(id);
        sessions.set(nextId, { state, expiresAt: Date.now() + 600000 }); cookie(res, nextId, 600);
        const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', state });
        res.writeHead(302, { Location: 'https://anilist.co/api/v2/oauth/authorize?' + params }); return res.end();
      }
      if (url.pathname === '/api/oauth/anilist/callback' && req.method === 'GET') {
        if (!current?.state || url.searchParams.get('state') !== current.state) return send(400, { error: 'Invalid or expired OAuth state' });
        sessions.delete(id); // one use, including denied/failed callbacks
        if (!url.searchParams.get('code') || url.searchParams.has('error')) return send(400, { error: 'AniList authorization was denied' });
        const response = await fetch('https://anilist.co/api/v2/oauth/token', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', client_id: process.env.ANILIST_CLIENT_ID, client_secret: process.env.ANILIST_CLIENT_SECRET, redirect_uri: process.env.ANILIST_REDIRECT_URI, code: url.searchParams.get('code') }) });
        if (!response.ok) return send(502, { error: 'AniList token exchange failed' });
        const data = await response.json();
        if (typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in) || data.expires_in <= 0) return send(502, { error: 'Invalid AniList token response' });
        const nextId = token(); sessions.set(nextId, { accessToken: data.access_token, expiresAt: Date.now() + Math.min(data.expires_in, 86400) * 1000 }); cookie(res, nextId, Math.min(data.expires_in, 86400));
        res.writeHead(302, { Location: origin + '/?oauth=anilist' }); return res.end();
      }
      if (url.pathname === '/api/oauth/anilist/logout' && req.method === 'POST') { sessions.delete(id); cookie(res, '', 0); return send(200, { success: true }); }
      if (url.pathname === '/api/oauth/anilist/session' && req.method === 'GET') return send(current?.accessToken ? 200 : 401, { authenticated: !!current?.accessToken });
      if (url.pathname === '/api/oauth/anilist/graphql' && req.method === 'POST') {
        if (!current?.accessToken) return send(401, { error: 'Not authenticated' });
        const payload = await body(req);
        if (typeof payload.query !== 'string') return send(400, { error: 'Missing query' });
        const upstream = await fetch('https://graphql.anilist.co', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + current.accessToken }, body: JSON.stringify(payload) });
        if (upstream.status === 401) sessions.delete(id);
        return send(upstream.status, await upstream.json());
      }
      send(404, { error: 'Not found' });
    } catch { send(502, { error: 'OAuth service request failed' }); }
  });
}
const cleanup = setInterval(() => { for (const [id, session] of sessions) if (session.expiresAt < Date.now()) sessions.delete(id); }, 60000); cleanup.unref();
if (require.main === module) createServer().listen(Number(process.env.PORT || 3001), '127.0.0.1');
module.exports = { createServer, sessions };
