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
