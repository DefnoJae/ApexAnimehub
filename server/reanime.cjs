const { parseExpressionAt } = require("acorn");
const { createHash, pbkdf2Sync, createDecipheriv } = require("node:crypto");
const { Worker } = require("node:worker_threads");

const site = "https://reanime.cz";
const player = "https://flixcloud.cc";
const hash = (value) => createHash("sha256").update(value).digest();
const hex = (value) => hash(value).toString("hex");

function mediaUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !/^(fetch\d+\.flixcloud\.cc|vault-\d+\.(rundowncdn|titancdn|apexcdn)\.top)$/.test(url.hostname))
    throw new Error("Unknown Re:Anime media host");
  return url;
}

async function read(url, signal, headers = {}) {
  const response = await fetch(url, {
    signal, redirect: "error",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", ...headers },
  });
  if (!response.ok) throw new Error("Re:Anime upstream " + new URL(url).hostname + " returned " + response.status);
  return response;
}

function literal(node) {
  if (node.type === "Literal") return node.value;
  if (node.type === "ArrayExpression") return node.elements.map(literal);
  if (node.type === "ObjectExpression")
    return Object.fromEntries(node.properties.map((prop) => {
      if (prop.type !== "Property" || prop.computed || prop.method || prop.kind !== "init")
        throw new Error("Unsupported provider metadata");
      return [prop.key.name ?? prop.key.value, literal(prop.value)];
    }));
  if (node.type === "UnaryExpression" && node.operator === "-" && typeof node.argument.value === "number")
    return -node.argument.value;
  if (node.type === "Identifier" && node.name === "undefined") return undefined;
  throw new Error("Unsupported provider metadata");
}

function decodeMaterial(wasm, fragment, extra, token, seed) {
  if (wasm.length > 16384 || !fragment.length || fragment.length > 128 ||
      extra.length !== fragment.length || token.length !== fragment.length)
    throw new Error("Invalid decoder input");
  // Keep the provider's small, import-free decoder off the request thread.
  const worker = new Worker(`
    const { parentPort, workerData: d } = require("node:worker_threads");
    const mod = new WebAssembly.Module(d.wasm);
    if (WebAssembly.Module.imports(mod).length) throw new Error("Unexpected decoder imports");
    const { memory, _s, _r, _c } = new WebAssembly.Instance(mod).exports;
    const mem = new Uint8Array(memory.buffer);
    mem.set(d.fragment, 0);
    mem.set(d.extra, 128);
    mem.set(d.token, 256);
    _s(d.seed);
    _r(0, 128, 256, 384, d.fragment.length);
    const key = _c();
    parentPort.postMessage([mem.slice(384, 384 + d.fragment.length), mem.slice(key, key + 32)]);
  `, { eval: true, workerData: { wasm, fragment, extra, token, seed },
    resourceLimits: { maxOldGenerationSizeMb: 16 } });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error("Re:Anime decoder timed out"));
    }, 1500);
    const finish = (callback, value) => {
      clearTimeout(timer);
      void worker.terminate();
      callback(value);
    };
    worker.once("message", (data) => finish(resolve, data));
    worker.once("error", (error) => finish(reject, error));
    worker.once("exit", () => finish(reject, new Error("Re:Anime decoder exited")));
  });
}

async function resolveReanime(id, episode, audio, signal) {
  const response = await read(`${site}/api/flix/${id}/${episode}`, signal);
  const { servers } = await response.json();
  const entry = Array.isArray(servers) && servers.find((item) => item.serverName === "HD-1" && item.dataType === audio);
  if (!entry) throw new Error("Requested audio unavailable");
  const embed = new URL(entry.dataLink);
  if (embed.origin !== player || !embed.pathname.startsWith("/e/"))
    throw new Error("Unknown Re:Anime player host");
  const html = await (await read(embed, signal, { Referer: site + "/" })).text();
  const prefix = '{type:"data",data:';
  const offset = html.indexOf(prefix);
  if (offset < 0 || html.length > 512000) throw new Error("Re:Anime metadata unavailable");
  const parsed = parseExpressionAt(html, offset + prefix.length, { ecmaVersion: 2020 });
  const expression = parsed.type === "SequenceExpression" ? parsed.expressions[0] : parsed;
  if (expression.type !== "ObjectExpression") throw new Error("Invalid provider metadata");
  const data = {};
  for (const prop of expression.properties) {
    const name = prop.key?.name ?? prop.key?.value;
    if (typeof name === "string" && /^(obfuscation_seed|obfuscated_crypto_data|w_payload|subtitles|[a-f0-9]+_[a-f0-9]+)$/.test(name))
      data[name] = literal(prop.value);
  }
  const seed = data.obfuscation_seed;
  if (!/^[a-f0-9]{16}$/i.test(seed)) throw new Error("Invalid Re:Anime seed");
  const rounds = (start) => [0, 1, 2].reduce((value, round) => hex(value + round), start);
  const first = rounds(seed);
  const second = rounds(first);
  const object = data.obfuscated_crypto_data?.["cd_" + first.slice(24, 32)]?.["ad_" + first.slice(32, 40)]?.[0]?.["od_" + first.slice(40, 48)];
  const token = data[first.slice(48, 64) + "_" + first.slice(56, 64)];
  if (!object || !/^[a-z0-9]{8,128}$/i.test(token)) throw new Error("Invalid Re:Anime token");
  const exchange = await (await read(`${player}/api/m3u8/${token}`, signal, { Referer: embed.href })).json();
  const bytes = (input) => Buffer.from(input || "", "base64");
  const [material, playlistKey] = await decodeMaterial(
    bytes(data.w_payload),
    bytes(object["kf_" + first.slice(8, 16)]),
    bytes(data[second.slice(0, 16) + "_" + second.slice(16, 24)]),
    bytes(exchange[hex(token + "key").slice(0, 10)]),
    parseInt(seed.slice(0, 8), 16),
  );
  const derived = pbkdf2Sync(material, seed, 1000, 32, "sha256");
  for (let index = 0; index < derived.length; index++)
    derived[index] ^= seed.charCodeAt(index % seed.length);
  const decipher = createDecipheriv("aes-256-cbc", hash(derived), bytes(object["ivf_" + first.slice(16, 24)]));
  const stream = Buffer.concat([decipher.update(bytes(exchange[hex(token + "vid").slice(0, 10)])), decipher.final()]);
  return {
    stream: mediaUrl(stream.toString().replace(/\0/g, "").trim()).href,
    playlistKey: Buffer.from(playlistKey).toString("base64"),
    subtitles: Array.isArray(data.subtitles) ? data.subtitles : [],
  };
}

module.exports = { mediaUrl, resolveReanime, player };


const { createHmac, timingSafeEqual } = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
const secret = () => process.env.SESSION_SECRET || process.env.ANILIST_CLIENT_SECRET || process.env.MAL_CLIENT_SECRET;
const signature = (value) => createHmac("sha256", secret()).update("apex-media:" + value).digest();
function relayUrl(url, key, audio, expires) {
  const value = Buffer.from(JSON.stringify([mediaUrl(url).href, key, audio, expires])).toString("base64url");
  return "/api/playback?media=" + value + "." + signature(value).toString("base64url");
}

async function resolvePlayback(id, episode, audio) {
  if (!secret()) throw new Error("Re:Anime delivery is unavailable");
  const result = await resolveReanime(id, episode, audio, AbortSignal.timeout(8500));
  const expires = Date.now() + 4 * 60 * 60 * 1000;
  const subtitles = [];
  for (const track of result.subtitles.slice(0, 30)) {
    const format = String(track.format || "").toLowerCase();
    if (!["vtt", "srt", "ass"].includes(format) || typeof track.language !== "string") continue;
    try {
      subtitles.push({
        url: relayUrl(track.url, "", audio, expires),
        label: track.language.slice(0, 120),
        format,
      });
    } catch {}
  }
  return {
    url: relayUrl(result.stream, result.playlistKey, audio, expires),
    subtitles,
    audio,
    quality: "auto",
    provider: "Re:Anime",
  };
}

function rewritePlaylist(text, url, key, audio, expires) {
  if (!text.trimStart().startsWith("#EXTM3U")) {
    const secretKey = Buffer.from(key, "base64");
    if (secretKey.length !== 32) throw new Error("Invalid playlist key");
    text = Buffer.from(text.trim(), "base64").map((byte, index) => byte ^ secretKey[index % secretKey.length]).toString();
  }
  if (!text.startsWith("#EXTM3U")) throw new Error("Invalid playlist");
  const lines = text.split(/\r?\n/);
  const tracks = lines.filter((line) => line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO"));
  const language = audio === "dub" ? /LANGUAGE="en(?:g|-[^"]+)?"|NAME="English"/i : /LANGUAGE="ja(?:pn|-[^"]+)?"|LANGUAGE="jpn"|NAME="Japanese"/i;
  if (tracks.length && !tracks.some((line) => language.test(line)))
    throw new Error("Requested audio missing from playlist");
  const rewrite = (path) => relayUrl(new URL(path, url), key, audio, expires);
  return lines.filter((line) => !tracks.includes(line) || language.test(line)).map((line) => {
    if (tracks.includes(line)) line = line.replace("DEFAULT=NO", "DEFAULT=YES").replace("AUTOSELECT=NO", "AUTOSELECT=YES");
    if (!line || line.startsWith("#")) return line.replace(/URI="([^"]+)"/g, (_, path) => 'URI="' + rewrite(path) + '"');
    return rewrite(line.trim());
  }).join("\n");
}

async function serveMedia(req, res, token) {
  try {
    if (req.method !== "GET" || !secret() || token.length > 6000) throw new Error();
    const [value, encoded, extra] = token.split(".");
    if (extra || !encoded) throw new Error();
    const mac = Buffer.from(encoded, "base64url");
    const expected = signature(value);
    if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) throw new Error();
    const [href, key, audio, expires] = JSON.parse(Buffer.from(value, "base64url").toString());
    if (expires < Date.now()) throw new Error();
    const url = mediaUrl(href);
    try {
      const response = await read(url, AbortSignal.timeout(15000), {
        Origin: player, Referer: player + "/", ...(req.headers.range ? { Range: req.headers.range } : {}),
      });
      res.setHeader("Cache-Control", "private, max-age=120");
      if (url.pathname.endsWith(".m3u8") || /mpegurl/i.test(response.headers.get("content-type") || "")) {
        const text = await response.text();
        if (text.length > 2_000_000) throw new Error("Playlist too large");
        const playlist = rewritePlaylist(text, url, key, audio, expires);
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        return res.end(playlist);
      }
      res.statusCode = response.status;
      res.setHeader("Content-Type", "application/octet-stream");
      for (const header of ["content-length", "content-range", "accept-ranges"]) {
        const value = response.headers.get(header);
        if (value) res.setHeader(header, value);
      }
      return await pipeline(Readable.fromWeb(response.body), res);
    } catch {
      if (res.headersSent) return res.destroy();
      res.statusCode = 502;
      return res.end("Media unavailable");
    }
  } catch {
    res.statusCode = 403;
    return res.end("Invalid media link");
  }
}

module.exports.resolvePlayback = resolvePlayback;
module.exports.serveMedia = serveMedia;
