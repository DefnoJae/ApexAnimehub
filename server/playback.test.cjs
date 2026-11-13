const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handler, coverId, allowed } = require('./playback.cjs');
test('playback matches exact AniList identity and only accepts the supported media host', () => {
  assert.equal(coverId('https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-test.jpg'), 16498);
  assert.equal(coverId('https://evil.test/16498-test.jpg'), 0);
  assert.equal(allowed('https://stream.animeparadise.moe/m3u8?url=token'), true);
  assert.equal(allowed('https://stream.animeparadise.moe.evil.test/media'), false);
});
test('playback rejects invalid IDs and methods before contacting a source', async () => {
  for (const [method, url, expected] of [['GET','/api/playback?id=-1&episode=1',400],['POST','/api/playback?id=1&episode=1',405],['GET','/api/playback?id=1&episode=0',400]]) {
    const response = { setHeader() {}, end(body) { this.body = body; } };
    await handler({ method, url }, response);
    assert.equal(response.statusCode, expected);
    assert.ok(JSON.parse(response.body).error);
  }
});

test("paused playback rejects relay requests and new playback sessions", async () => {
  const response = { setHeader() {}, end(body) { this.body = body; } };
  await handler({ method: "GET", url: "/api/playback?media=forged.signature" }, response);
  assert.equal(response.statusCode, 410);
  await handler({ method: "GET", url: "/api/playback?id=1&episode=2&audio=dub" }, response);
  assert.equal(response.statusCode, 503);
});

test("Re:Anime media allowlist rejects redirects disguised as URLs", () => {
  const { mediaUrl } = require("./reanime.cjs");
  assert.equal(mediaUrl("https://fetch9.flixcloud.cc/master.m3u8").hostname, "fetch9.flixcloud.cc");
  for (const url of ["https://fetch9.flixcloud.cc.evil.test/media", "https://127.0.0.1/media", "https://user@fetch9.flixcloud.cc/media", "http://fetch9.flixcloud.cc/media"])
    assert.throws(() => mediaUrl(url));
});
