const ACTIVE_MS = 65000;
const VISITORS = "apex:presence:{live}:visitors";
const ID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

// Update the tab and browser totals atomically across Vercel instances.
const UPDATE = `
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local visitor = ARGV[3]
local tab = ARGV[4]
local sequence = tonumber(ARGV[5])
local previous = tonumber(redis.call('GET', KEYS[3]) or '0')
if sequence > previous then
  redis.call('SET', KEYS[3], sequence, 'PX', ttl * 2)
  redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
  if ARGV[6] == 'active' then
    redis.call('ZADD', KEYS[2], now + ttl, tab)
  else
    redis.call('ZREM', KEYS[2], tab)
  end
  local latest = redis.call('ZREVRANGE', KEYS[2], 0, 0, 'WITHSCORES')
  if #latest > 0 then
    redis.call('PEXPIRE', KEYS[2], ttl)
    redis.call('ZADD', KEYS[1], latest[2], visitor)
    redis.call('PEXPIRE', KEYS[1], ttl)
  else
    redis.call('ZREM', KEYS[1], visitor)
  end
end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
return redis.call('ZCARD', KEYS[1])
`;

async function readBody(req) {
  let raw = req.body;
  if (raw === undefined) {
    raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 512) throw new Error("Body too large");
    }
  }
  if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
  if (typeof raw !== "string") return raw;
  if (raw.length > 512) throw new Error("Body too large");
  return JSON.parse(raw);
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  const send = (status, body) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(405, { error: "Method not allowed" });
  }
  try {
    const origin = new URL(req.headers.origin);
    if (
      origin.host !== req.headers.host ||
      !["https:", "http:"].includes(origin.protocol)
    )
      return send(403, { error: "Invalid origin" });
  } catch {
    return send(403, { error: "Invalid origin" });
  }
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    res.setHeader("Retry-After", "300");
    return send(503, { error: "Presence unavailable" });
  }

  let input;
  try {
    input = await readBody(req);
  } catch {
    return send(400, { error: "Invalid presence update" });
  }
  const { visitor, tab, sequence, state } = input || {};
  if (
    typeof visitor !== "string" ||
    !ID.test(visitor) ||
    typeof tab !== "string" ||
    !ID.test(tab) ||
    !Number.isSafeInteger(sequence) ||
    sequence < 1 ||
    (state !== "active" && state !== "hidden")
  )
    return send(400, { error: "Invalid presence update" });
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        UPDATE,
        3,
        VISITORS,
        VISITORS + ":" + visitor,
        VISITORS + ":" + visitor + ":" + tab,
        Date.now(),
        ACTIVE_MS,
        visitor,
        tab,
        sequence,
        state,
      ]),
      signal: AbortSignal.timeout(5000),
    });
    const { result } = await response.json();
    if (!response.ok || !Number.isSafeInteger(result) || result < 0)
      throw new Error("Presence store unavailable");
    return send(200, { count: result });
  } catch {
    return send(503, { error: "Presence unavailable" });
  }
}

module.exports = { handler };
