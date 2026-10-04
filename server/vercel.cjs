const { randomBytes, createHash, createCipheriv, createDecipheriv } = require('node:crypto');
const { createServer, sessions } = require('./oauth.cjs');
function key() { const secret = process.env.SESSION_SECRET || process.env.ANILIST_CLIENT_SECRET || process.env.MAL_CLIENT_SECRET; if (!secret || secret.length < 16) throw new Error('Set SESSION_SECRET to a strong random server secret'); return createHash('sha256').update(secret).digest(); }
function seal(session) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv); const bytes = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64url'); }
function open(value) { try { const bytes = Buffer.from(value, 'base64url'); const cipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(12, 28)); const session = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString()); return session.expiresAt > Date.now() ? session : null; } catch { return null; } }
const server = createServer();
function handler(req, res) {
  try { key(); req.apexSessionReady = true; } catch { req.apexSessionReady = false; }
  // Encrypted, authenticated cookies survive Vercel instance changes. Never serialize refreshing promises.
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(part => { const at = part.indexOf('='); return [part.slice(0, at).trim(), part.slice(at + 1)]; }));
  const value = (cookies.apex_auth_0 || '') + (cookies.apex_auth_1 || '') + (cookies.apex_auth_2 || '');
  const session = value ? open(value) : null;
  const initial = session ? JSON.stringify(session) : null;
  const id = randomBytes(32).toString('hex');
  if (session) sessions.set(id, session);
  req.headers.cookie = session ? 'apex_session=' + id : '';
  const originalEnd = res.end;
  const originalWriteHead = res.writeHead;
  // Delay headers until the updated session cookies have been written.
  res.writeHead = function(status, message, headers) {
    res.statusCode = status;
    const values = typeof message === 'object' ? message : headers;
    for (const [name, value] of Object.entries(values || {})) res.setHeader(name, value);
    return res;
  };
  function finish(args) {
    res.writeHead = originalWriteHead;
    return originalEnd.apply(res, args);
  }
  res.end = function(...args) {
    const setCookie = res.getHeader('Set-Cookie');
    const match = /apex_session=([a-f0-9]{64})/.exec(String(setCookie || ''));
    const nextId = match ? match[1] : id;
    const next = sessions.get(nextId);
    try {
      if (next) {
        const clean = { ...next, accounts: Object.fromEntries(Object.entries(next.accounts || {}).map(([provider, account]) => { const { refreshing, ...saved } = account; return [provider, saved]; })) };
        if (JSON.stringify(clean) === initial && !setCookie) { sessions.delete(id); return finish(args); }
        const sealed = seal(clean);
        if (sealed.length > 10500) throw new Error('Account session too large');
        res.setHeader('Set-Cookie', [0, 1, 2].map(i => 'apex_auth_' + i + '=' + sealed.slice(i * 3500, (i + 1) * 3500) + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + (sealed.slice(i * 3500, (i + 1) * 3500) ? Math.max(0, Math.floor((clean.expiresAt - Date.now()) / 1000)) : 0)));
      } else if (value) res.setHeader('Set-Cookie', [0,1,2].map(i => 'apex_auth_' + i + '=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'));
    } catch { res.statusCode = 503; res.removeHeader('Location'); args = [JSON.stringify({ error: 'Account sessions are not configured. Set a strong SESSION_SECRET in Vercel.' })]; }
    sessions.delete(id); sessions.delete(nextId);
    return finish(args);
  };
  server.emit('request', req, res);
}
module.exports = { handler, seal, open };
