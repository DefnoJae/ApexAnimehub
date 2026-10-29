const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  makeCues,
  episodeAttachments,
  allowed,
  handler,
  search,
} = require("./signsync.cjs");
const ass =
  "[Script Info]\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:10.00,0:00:13.00,Signs,,0,0,0,,{\\pos(20,30)}A street sign\nDialogue: 0,0:00:14.00,0:00:16.00,Default,,0,0,0,,Ordinary dialogue\nDialogue: 0,0:00:17.00,0:00:19.00,Signs,,0,0,0,,{\\p1}m 0 0 l 2 2";
test("SeaSubs extraction keeps signs, excludes dialogue and drawings, and emits safe text", () => {
  assert.deepEqual(makeCues(ass), [
    { start: 10, end: 13, text: "A street sign" },
  ]);
  assert.deepEqual(
    makeCues("WEBVTT\n\n00:00:10.000 --> 00:00:13.000\n<b>Title</b>", true),
    [{ start: 10, end: 13, text: "Title" }],
  );
  assert.equal(
    makeCues("WEBVTT\n\n00:00:10.000 --> 00:00:13.000\nDialogue").length,
    0,
  );
});
test("episode identity and outbound host checks exclude unrelated files and addresses", () => {
  const a = { id: 1, type: "subtitle" };
  assert.equal(
    episodeAttachments(
      { files: [{ filename: "Show S02E04.mkv", attachments: [a] }] },
      4,
      1,
    ).length,
    0,
  );
  assert.deepEqual(
    episodeAttachments(
      {
        files: [
          { filename: "Show - 04.mkv", attachments: [a] },
          { filename: "Show - 05.mkv", attachments: [{ ...a, id: 2 }] },
        ],
      },
      4,
      1,
    ),
    [a],
  );
  for (const url of [
    "http://127.0.0.1/attachments/a",
    "https://storage.animetosho.net.evil.com/attachments/a",
    "https://storage.animetosho.net:8080/attachments/a",
    "https://user:pass@storage.animetosho.net/attachments/a",
  ])
    assert.equal(allowed(url), false);
  assert.equal(
    allowed("https://storage.animetosho.net/attachments/001/a.xz"),
    true,
  );
});
test("search reuses exact episode results and decodes styled signs without exposing download URLs", async () => {
  const before = global.fetch;
  let calls = 0;
  global.fetch = async (raw) => {
    calls++;
    const u = new URL(raw);
    if (u.hostname === "api.ani.zip")
      return Response.json({
        mappings: { anilist_id: 987654 },
        episodes: { 4: { anidbEid: 42, seasonNumber: 1 } },
      });
    if (u.searchParams.get("eid"))
      return Response.json([
        {
          id: 7,
          anidb_eid: 42,
          status: "complete",
          title: "Show S01E04 Dual Audio",
        },
      ]);
    if (u.searchParams.get("show"))
      return Response.json({
        files: [
          {
            filename: "Show S01E04.mkv",
            attachments: [
              {
                id: 8,
                type: "subtitle",
                info: { language_code: "eng", format: "ASS", name: "English" },
                url: "https://storage.animetosho.net/attachments/001/a.ass",
              },
            ],
          },
        ],
      });
    return new Response(ass);
  };
  try {
    const result = await search(987654, 4);
    assert.equal(result.tracks[0].cues.length, 1);
    assert.equal("url" in result.tracks[0], false);
    const n = calls;
    assert.deepEqual(await search(987654, 4), result);
    assert.equal(calls, n);
  } finally {
    global.fetch = before;
  }
});
test("invalid requests fail without contacting providers", async () => {
  let body = "";
  const res = {
    setHeader() {},
    end(v) {
      body = v;
    },
  };
  await handler({ method: "GET", url: "/api/signsync?id=1&episode=-3" }, res);
  assert.equal(res.statusCode, 400);
  assert.match(body, /Invalid/);
});

test("SeaSubs bounded XZ decoder validates compressed subtitle integrity", () => {
  const { decode } = require("./seasubs-xz.cjs");
  const bytes = Buffer.from(
    "/Td6WFoAAATm1rRGAgAhARYAAAB0L+Wj4AAzAC1dACuRREy8Hw3FG12cIzMbL6wQQn4EVsU1Lh0Tt60cHDWoOmobhgT3FchZjH8AAAAAAACv0UoOMmG3tgABSTTStYkgH7bzfQEAAAAABFla",
    "base64",
  );
  assert.match(decode(bytes), /A street sign/);
  bytes[bytes.length - 20] ^= 1;
  assert.throws(() => decode(bytes));
});
