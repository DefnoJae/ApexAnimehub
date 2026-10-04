// Same-origin OAuth service. Both providers' credentials stay on the server.
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { updateList, validateUpdate } = require('./list.cjs');
const origin = process.env.APP_ORIGIN || 'http://localhost:3000';
const sessions = new Map();
const locks = new Map();
const token = () => randomBytes(32).toString('hex');
function cookie(res, id, age = 86400) {
  res.setHeader('Set-Cookie', 'apex_session=' + id + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + age + (origin.startsWith('https:') ? '; Secure' : ''));
}
async function body(req) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > 32768) throw new Error('Request too large'); }
  return JSON.parse(data);
}
function config(provider) {
  const prefix = provider === 'mal' ? 'MAL' : 'ANILIST';
  return { clientId: process.env[prefix + '_CLIENT_ID'], secret: process.env[prefix + '_CLIENT_SECRET'], redirect: process.env[prefix + '_REDIRECT_URI'], tokenUrl: provider === 'mal' ? 'https://myanimelist.net/v1/oauth2/token' : 'https://anilist.co/api/v2/oauth/token' };
}
async function accessAccount(session, provider) {
  const account = session?.accounts?.[provider];
  if (!account) return null;
  if (account.expiresAt > Date.now() + 60000) return account;
  if (provider !== 'mal' || !account.refreshToken) { delete session.accounts[provider]; return null; }
  if (!account.refreshing) account.refreshing = (async () => {
    const cfg = config('mal');
    const response = await fetch(cfg.tokenUrl, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: account.refreshToken, client_id: cfg.clientId, ...(cfg.secret ? { client_secret: cfg.secret } : {}) }).toString() });
    const data = await response.json();
    if (!response.ok || typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in)) throw new Error('MAL session expired. Please reconnect.');
    account.accessToken = data.access_token; account.refreshToken = data.refresh_token || account.refreshToken; account.expiresAt = Date.now() + data.expires_in * 1000;
  })().finally(() => { delete account.refreshing; });
  try { await account.refreshing; return account; } catch (error) { delete session.accounts.mal; throw error; }
}
function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const url = new URL(req.url, origin);
    const id = /(?:^|; )apex_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (sessions.get(id)?.expiresAt < Date.now()) sessions.delete(id);
    const current = sessions.get(id);
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      if (req.method === 'POST' && req.headers.origin !== origin) return send(403, { error: 'Invalid origin' });
      const route = /^\/api\/oauth\/(anilist|mal)\/(start|callback|session|logout|graphql)$/.exec(url.pathname);
      if (route) {
        const [, provider, action] = route;
        const cfg = config(provider);
        if (action === 'start' && req.method === 'GET') {
          if (!cfg.clientId || !cfg.redirect || (provider === 'anilist' && !cfg.secret)) return send(503, { error: provider + ' OAuth server is not configured' });
          // Retain the other provider when connecting a second account.
          const nextId = id && current ? id : token();
          const session = current || { accounts: {}, pending: {}, expiresAt: Date.now() + 86400000 };
          const state = token(), verifier = token();
          session.pending[provider] = { state, verifier, expiresAt: Date.now() + 600000 };
          sessions.set(nextId, session); cookie(res, nextId);
          const params = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirect, response_type: 'code', state });
          if (provider === 'mal') { params.set('code_challenge', verifier); params.set('code_challenge_method', 'plain'); }
          res.writeHead(302, { Location: (provider === 'mal' ? 'https://myanimelist.net/v1/oauth2/authorize?' : 'https://anilist.co/api/v2/oauth/authorize?') + params }); return res.end();
        }
        if (action === 'callback' && req.method === 'GET') {
          const pending = current?.pending?.[provider];
          if (!pending || pending.expiresAt < Date.now() || url.searchParams.get('state') !== pending.state) return send(400, { error: 'Invalid or expired OAuth state' });
          delete current.pending[provider];
          const redirectBack = (result) => { res.writeHead(302, { Location: origin + '/?oauth=' + provider + '&result=' + result }); res.end(); };
          if (!url.searchParams.get('code') || url.searchParams.has('error')) return redirectBack('denied');
          const fields = { grant_type: 'authorization_code', client_id: cfg.clientId, redirect_uri: cfg.redirect, code: url.searchParams.get('code'), ...(cfg.secret ? { client_secret: cfg.secret } : {}), ...(provider === 'mal' ? { code_verifier: pending.verifier } : {}) };
          const response = await fetch(cfg.tokenUrl, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': provider === 'mal' ? 'application/x-www-form-urlencoded' : 'application/json' }, body: provider === 'mal' ? new URLSearchParams(fields).toString() : JSON.stringify(fields) });
          if (!response.ok) return redirectBack('failed');
          const data = await response.json();
          if (typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in) || data.expires_in <= 0) return redirectBack('failed');
          current.accounts[provider] = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + data.expires_in * 1000 };
          const nextId = token(); sessions.delete(id); sessions.set(nextId, current); cookie(res, nextId);
          return redirectBack('connected');
        }
        if (action === 'logout' && req.method === 'POST') { if (current) { delete current.accounts[provider]; delete current.pending[provider]; } return send(200, { success: true }); }
        const account = await accessAccount(current, provider);
        if (action === 'session' && req.method === 'GET') return send(account ? 200 : 401, { authenticated: !!account });
        if (action === 'graphql' && provider === 'anilist' && req.method === 'POST') {
          if (!account) return send(401, { error: 'Not authenticated' });
          const payload = await body(req);
          if (typeof payload.query !== 'string') return send(400, { error: 'Missing query' });
          const upstream = await fetch('https://graphql.anilist.co', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + account.accessToken }, body: JSON.stringify(payload) });
          if (upstream.status === 401) delete current.accounts[provider];
          return send(upstream.status, await upstream.json());
        }
      }
      const listRoute = /^\/api\/list\/(anilist|mal)$/.exec(url.pathname);
      if (listRoute && req.method === 'POST') {
        const provider = listRoute[1];
        const account = await accessAccount(current, provider);
        if (!account) return send(401, { error: 'Please connect your ' + provider + ' account.' });
        const input = await body(req);
        try { validateUpdate(input); } catch (error) { return send(400, { error: error.message }); }
        const key = id + ':' + provider + ':' + input.id;
        const previous = locks.get(key) || Promise.resolve();
        const update = previous.catch(() => {}).then(() => updateList(provider, account, input));
        locks.set(key, update);
        try { return send(200, { success: true, entry: await update }); }
        finally { if (locks.get(key) === update) locks.delete(key); }
      }
      send(404, { error: 'Not found' });
    } catch (error) { send(502, { error: error.message || 'OAuth service request failed' }); }
  });
}
const cleanup = setInterval(() => { for (const [id, session] of sessions) if (session.expiresAt < Date.now()) sessions.delete(id); }, 60000); cleanup.unref();
if (require.main === module) createServer().listen(Number(process.env.PORT || 3001), '127.0.0.1');
module.exports = { createServer, sessions };
