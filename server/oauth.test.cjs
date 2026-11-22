const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createServer, sessions } = require("./oauth.cjs");
const {
  updateList,
  readList,
  readEntry,
  validateUpdate,
} = require("./list.cjs");
const browserFetch = global.fetch;
const json = (data) => ({ ok: true, status: 200, json: async () => data });
const origin = "http://localhost:3000";
test("list imports authenticate, paginate and normalize provider-specific statuses and IDs", async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("graphql"))
      return json({
        data: JSON.parse(options.body).query.includes("Viewer")
          ? { Viewer: { id: 2, name: "Alice" } }
          : {
              Page: {
                pageInfo: { hasNextPage: true },
                mediaList: [
                  {
                    status: "PAUSED",
                    progress: 7,
                    updatedAt: 10,
                    media: { id: 3, idMal: 4 },
                  },
                ],
              },
            },
      });
    if (url.endsWith("/@me")) return json({ id: 5, name: "Bob" });
    return json({
      data: [
        {
          node: { id: 4, title: "Example", num_episodes: 12 },
          list_status: { status: "plan_to_watch", num_episodes_watched: 0 },
        },
      ],
      paging: { next: "ignored-provider-url" },
    });
  };
  try {
    const ani = await readList("anilist", { accessToken: "private" }, 2);
    assert.equal(ani.identity, "2");
    assert.equal(ani.entries[0].status, "paused");
    assert.equal(ani.hasNextPage, true);
    assert.equal(JSON.parse(calls[1].options.body).variables.page, 2);
    const mal = await readList("mal", { accessToken: "private" }, 2);
    assert.equal(mal.entries[0].anime.idMal, 4);
    assert.equal(mal.entries[0].anime.id, 0);
    assert.equal(mal.entries[0].status, "planning");
    assert.match(calls.at(-1).url, /offset=100/);
    assert.ok(!JSON.stringify(mal).includes("private"));
    await assert.rejects(readList("mal", {}, -1));
  } finally {
    global.fetch = browserFetch;
  }
});
async function serve(run) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run("http://127.0.0.1:" + server.address().port);
  } finally {
    global.fetch = browserFetch;
    sessions.clear();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
test("OAuth rejects forged state and cross-origin writes; denial consumes state", () =>
  serve(async (base) => {
    assert.equal(
      (
        await browserFetch(
          base + "/api/oauth/anilist/callback?code=x&state=forged",
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await browserFetch(base + "/api/list/mal", {
          method: "POST",
          headers: { Origin: "https://attacker.example" },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (await browserFetch(base + "/api/oauth/anilist/session")).status,
      401,
    );
    process.env.ANILIST_CLIENT_ID = "test";
    process.env.ANILIST_CLIENT_SECRET = "server-only";
    process.env.ANILIST_REDIRECT_URI = origin + "/api/oauth/anilist/callback";
    const start = await browserFetch(base + "/api/oauth/anilist/start", {
      redirect: "manual",
    });
    const cookie = start.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly; SameSite=Lax/);
    const state = new URL(start.headers.get("location")).searchParams.get(
      "state",
    );
    assert.equal(state.length, 64);
    const callbackURL =
      base + "/api/oauth/anilist/callback?error=access_denied&state=" + state;
    const headers = { Cookie: cookie.split(";")[0] };
    const denied = await browserFetch(callbackURL, {
      headers,
      redirect: "manual",
    });
    assert.equal(denied.status, 302);
    assert.match(denied.headers.get("location"), /result=denied/);
    assert.equal(
      (await browserFetch(callbackURL, { headers, redirect: "manual" })).status,
      400,
    );
  }));
test("connect both accounts, keep tokens server-side, sync lists and disconnect independently", () =>
  serve(async (base) => {
    process.env.MAL_CLIENT_ID = "mal-client";
    process.env.MAL_REDIRECT_URI = origin + "/api/oauth/mal/callback";
    let cookie = "",
      calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      if (url.includes("/oauth") && url.endsWith("/token"))
        return json({
          access_token: "secret-access",
          refresh_token: "secret-refresh",
          expires_in: 3600,
        });
      if (url.includes("graphql")) {
        const input = JSON.parse(options.body);
        return json({
          data: input.query.startsWith("mutation")
            ? {
                SaveMediaListEntry: {
                  id: 1,
                  status: input.variables.status,
                  progress: input.variables.progress,
                },
              }
            : { Media: { mediaListEntry: { progress: 7, status: "CURRENT" } } },
        });
      }
      if (options.method === "PATCH")
        return json({ status: "watching", num_episodes_watched: 7 });
      return json({
        my_list_status: { num_episodes_watched: 7, status: "watching" },
      });
    };
    for (const provider of ["anilist", "mal"]) {
      const start = await browserFetch(
        base + "/api/oauth/" + provider + "/start",
        { headers: { Cookie: cookie }, redirect: "manual" },
      );
      cookie = start.headers.get("set-cookie").split(";")[0];
      const authorization = new URL(start.headers.get("location"));
      if (provider === "mal") {
        assert.equal(
          authorization.searchParams.get("code_challenge").length,
          64,
        );
        assert.equal(
          authorization.searchParams.get("code_challenge_method"),
          "plain",
        );
      }
      const callback = await browserFetch(
        base +
          "/api/oauth/" +
          provider +
          "/callback?code=test&state=" +
          authorization.searchParams.get("state"),
        { headers: { Cookie: cookie }, redirect: "manual" },
      );
      assert.equal(callback.status, 302);
      cookie = callback.headers.get("set-cookie").split(";")[0];
      assert.ok(!cookie.includes("secret-access"));
    }
    for (const provider of ["anilist", "mal"]) {
      const session = await browserFetch(
        base + "/api/oauth/" + provider + "/session",
        { headers: { Cookie: cookie } },
      );
      assert.deepEqual(await session.json(), { authenticated: true });
      const update = await browserFetch(base + "/api/list/" + provider, {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: 1,
          status: "watching",
          progress: 2,
          automatic: true,
        }),
      });
      assert.equal(update.status, 200);
    }
    const malPatch = calls.find((c) => c.options.method === "PATCH");
    assert.equal(
      new URLSearchParams(malPatch.options.body).get("num_watched_episodes"),
      "7",
    );
    const mutation = calls
      .filter((c) => c.url.includes("graphql"))
      .map((c) => JSON.parse(c.options.body))
      .find((c) => c.query.startsWith("mutation"));
    assert.equal(mutation.variables.progress, 7);
    await browserFetch(base + "/api/oauth/mal/logout", {
      method: "POST",
      headers: { Cookie: cookie, Origin: origin },
    });
    assert.equal(
      (
        await browserFetch(base + "/api/oauth/mal/session", {
          headers: { Cookie: cookie },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await browserFetch(base + "/api/oauth/anilist/session", {
          headers: { Cookie: cookie },
        })
      ).status,
      200,
    );
  }));
test("list mappings preserve progress on status changes and reject invalid input", async () => {
  assert.throws(() => validateUpdate({ id: 1, status: "toString" }));
  assert.throws(() =>
    validateUpdate({ id: 1, status: "watching", progress: -1 }),
  );
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push(options);
    return json({ data: { SaveMediaListEntry: { id: 1 } } });
  };
  try {
    for (const [status, expected] of [
      ["planning", "PLANNING"],
      ["paused", "PAUSED"],
      ["dropped", "DROPPED"],
      ["completed", "COMPLETED"],
    ]) {
      await updateList("anilist", { accessToken: "token" }, { id: 1, status });
      const input = JSON.parse(calls.at(-1).body);
      assert.equal(input.variables.status, expected);
      assert.equal("progress" in input.variables, false);
    }
  } finally {
    global.fetch = browserFetch;
  }
});

test("dates are written only on first transitions, on both server providers", async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("graphql")) {
      const input = JSON.parse(options.body);
      return json({
        data: input.query.startsWith("mutation")
          ? { SaveMediaListEntry: { id: 1, status: input.variables.status } }
          : {
              Media: {
                mediaListEntry: {
                  status: "PLANNING",
                  progress: 0,
                  startedAt: null,
                  completedAt: null,
                },
              },
            },
      });
    }
    return json({
      my_list_status: {
        status: "plan_to_watch",
        num_episodes_watched: 0,
        start_date: null,
        finish_date: null,
      },
    });
  };
  try {
    await updateList("anilist", { accessToken: "t" }, {
      id: 1,
      status: "watching",
      today: "2026-11-19",
    });
    const aniRequest = JSON.parse(calls.at(-1).options.body);
    const aniVariables = aniRequest.variables;
    assert.match(aniRequest.query, /\$startedAt:FuzzyDateInput\b/);
    assert.doesNotMatch(aniRequest.query, /\$startedAt:FuzzyDate\b/);
    assert.deepEqual(aniVariables.startedAt, { year: 2026, month: 11, day: 19 });
    assert.equal("completedAt" in aniVariables, false);

    await updateList("mal", { accessToken: "t" }, {
      id: 1,
      status: "watching",
      today: "2026-11-19",
    });
    const malFields = new URLSearchParams(calls.at(-1).options.body);
    assert.equal(malFields.get("start_date"), "2026-11-19");
    assert.equal(malFields.has("finish_date"), false);
    assert.match(calls.at(-2).url, /start_date,finish_date/);
  } finally {
    global.fetch = browserFetch;
  }
});

test("existing dates, target status, rewatch and progress-only saves write no date", async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("graphql")) {
      const input = JSON.parse(options.body);
      return json({
        data: input.query.startsWith("mutation")
          ? { SaveMediaListEntry: { id: 1, status: input.variables.status } }
          : {
              Media: {
                mediaListEntry: {
                  status: "REPEATING",
                  progress: 5,
                  startedAt: { year: 2020, month: 1, day: 2 },
                  completedAt: null,
                },
              },
            },
      });
    }
    return json({
      my_list_status: {
        status: "rewatching",
        num_episodes_watched: 5,
        start_date: "2020-01-02",
        finish_date: null,
      },
    });
  };
  try {
    await updateList("anilist", { accessToken: "t" }, {
      id: 1,
      status: "watching",
      today: "2026-11-19",
    });
    let variables = JSON.parse(calls.at(-1).options.body).variables;
    assert.equal("startedAt" in variables, false);

    await updateList("anilist", { accessToken: "t" }, {
      id: 1,
      status: "watching",
      progress: 6,
      today: "2026-11-19",
    });
    variables = JSON.parse(calls.at(-1).options.body).variables;
    assert.equal("startedAt" in variables, false);
    assert.equal(variables.progress, 6);

    await updateList("mal", { accessToken: "t" }, {
      id: 1,
      status: "watching",
      today: "2026-11-19",
    });
    let fields = new URLSearchParams(calls.at(-1).options.body);
    assert.equal(fields.has("start_date"), false);

    await updateList("mal", { accessToken: "t" }, {
      id: 1,
      status: "completed",
      today: "2026-11-19",
    });
    fields = new URLSearchParams(calls.at(-1).options.body);
    assert.equal(fields.get("finish_date"), "2026-11-19");
  } finally {
    global.fetch = browserFetch;
  }
});

test("validateUpdate rejects a malformed today", () => {
  assert.throws(
    () => validateUpdate({ id: 1, status: "watching", today: "2026-02-30" }),
    /Invalid date/,
  );
  assert.doesNotThrow(() =>
    validateUpdate({ id: 1, status: "watching", today: "2026-11-19" }),
  );
});

test("personal scores normalize AniList scale and preserve automatic progress while permitting explicit corrections", async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("graphql")) {
      const input = JSON.parse(options.body);
      return json({
        data: input.query.startsWith("mutation")
          ? {
              SaveMediaListEntry: {
                status: input.variables.status,
                progress: input.variables.progress,
                score: input.variables.score,
              },
            }
          : {
              Media: {
                mediaListEntry: { status: "CURRENT", progress: 8, score: 85 },
              },
            },
      });
    }
    if (options.method === "PATCH")
      return json({ status: "watching", num_episodes_watched: 2, score: 7 });
    return json({
      my_list_status: { status: "watching", num_episodes_watched: 8, score: 7 },
    });
  };
  try {
    assert.equal(
      (await readEntry("anilist", { accessToken: "test" }, 1)).score,
      8.5,
    );
    assert.equal(
      (await readEntry("mal", { accessToken: "test" }, 11)).score,
      7,
    );
    await updateList(
      "anilist",
      { accessToken: "test" },
      {
        id: 1,
        status: "watching",
        progress: 2,
        manualProgress: true,
        score: 8,
      },
    );
    let input = JSON.parse(calls.at(-1).options.body);
    assert.equal(input.variables.score, 80);
    assert.equal(input.variables.progress, 2);
    assert.match(input.query, /scoreRaw:/);
    await updateList(
      "anilist",
      { accessToken: "test" },
      { id: 1, status: "watching", progress: 2, automatic: true },
    );
    input = JSON.parse(calls.at(-1).options.body);
    assert.equal(input.variables.progress, 8);
    assert.equal("score" in input.variables, false);
    await updateList(
      "mal",
      { accessToken: "test" },
      {
        id: 11,
        status: "watching",
        progress: 2,
        manualProgress: true,
        score: 0,
      },
    );
    const fields = new URLSearchParams(calls.at(-1).options.body);
    assert.equal(fields.get("score"), "0");
    assert.equal(fields.get("num_watched_episodes"), "2");
    await assert.rejects(
      updateList("mal", {}, { id: 11, status: "watching", score: 8.5 }),
      /whole number/,
    );
    await assert.rejects(
      updateList("anilist", {}, { id: 1, status: "watching", score: 8.5 }),
      /whole number/,
    );
    for (const score of [-1, 11, "8", 8.5, 8.55, NaN])
      assert.throws(() => validateUpdate({ id: 1, status: "watching", score }));
    assert.throws(() =>
      validateUpdate({
        id: 1,
        status: "watching",
        automatic: true,
        manualProgress: true,
      }),
    );
  } finally {
    global.fetch = browserFetch;
  }
});

test("list removal uses the AniList entry ID and accepts MAL's empty successful response", async () => {
  const { deleteList } = require("./list.cjs");
  const calls = [];
  try {
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      if (url.includes("graphql")) {
        const body = JSON.parse(options.body);
        return json({
          data: body.query.startsWith("query")
            ? { Media: { mediaListEntry: { id: 777 } } }
            : { DeleteMediaListEntry: { deleted: true } },
        });
      }
      return {
        ok: true,
        status: 204,
        json: () => {
          throw new Error("204 has no body");
        },
      };
    };
    assert.equal(
      await deleteList("anilist", { accessToken: "test" }, 10),
      true,
    );
    assert.equal(JSON.parse(calls[1].options.body).variables.id, 777);
    assert.equal(await deleteList("mal", { accessToken: "test" }, 20), true);
    assert.equal(calls[2].options.method, "DELETE");
    await assert.rejects(deleteList("mal", {}, -1), /Invalid/);
  } finally {
    global.fetch = browserFetch;
  }
});

test("public MAL rating uses mean, never the user's personal score", async () => {
  const { readPublicRating } = require("./list.cjs");
  try {
    global.fetch = async () =>
      json({ mean: 8.58, my_list_status: { score: 2 } });
    assert.equal(await readPublicRating({ accessToken: "test" }, 16498), 8.58);
  } finally {
    global.fetch = browserFetch;
  }
});

test("MAL transient refresh failure preserves credentials; invalid grant disconnects", () =>
  serve(async (base) => {
    const id = "d".repeat(64);
    const account = {
      accessToken: "old",
      refreshToken: "refresh",
      expiresAt: Date.now() - 1000,
    };
    sessions.set(id, {
      accounts: { mal: account },
      pending: {},
      expiresAt: Date.now() + 60000,
    });
    global.fetch = async () =>
      new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
        status: 503,
      });
    const temporary = await browserFetch(base + "/api/oauth/mal/session", {
      headers: { Cookie: "apex_session=" + id },
    });
    assert.equal(temporary.status, 502);
    assert.equal(sessions.get(id).accounts.mal.refreshToken, "refresh");
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          access_token: "renewed",
          refresh_token: "rotated",
          expires_in: 3600,
        }),
        { status: 200 },
      );
    const retry = await browserFetch(base + "/api/oauth/mal/session", {
      headers: { Cookie: "apex_session=" + id },
    });
    assert.equal(retry.status, 200);
    assert.equal(account.accessToken, "renewed");
    account.expiresAt = Date.now() - 1000;
    global.fetch = async () =>
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
    await browserFetch(base + "/api/oauth/mal/session", {
      headers: { Cookie: "apex_session=" + id },
    });
    assert.equal(sessions.get(id).accounts.mal, undefined);
  }));

test("AniList token endpoint returns only the connected access token", async () =>
  serve(async (base) => {
    const id = "a".repeat(64);
    const expiresAt = Date.now() + 3600000;
    sessions.set(id, {
      accounts: {
        anilist: {
          accessToken: "token-from-session",
          refreshToken: "refresh-from-session",
          expiresAt,
          identity: { id: 77, name: "Tester" },
        },
      },
      expiresAt: Date.now() + 3600000,
    });
    const response = await browserFetch(
      base + "/api/oauth/anilist/token",
      { headers: { Cookie: "apex_session=" + id } },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      accessToken: "token-from-session",
      expiresAt,
      identity: "77",
    });
  }));
test("AniList token endpoint rejects missing or expired sessions", async () =>
  serve(async (base) => {
    assert.equal(
      (await browserFetch(base + "/api/oauth/anilist/token")).status,
      401,
    );
    const id = "b".repeat(64);
    sessions.set(id, {
      accounts: {
        anilist: {
          accessToken: "expired-token",
          expiresAt: Date.now() - 1000,
        },
      },
      expiresAt: Date.now() + 3600000,
    });
    const expired = await browserFetch(
      base + "/api/oauth/anilist/token",
      { headers: { Cookie: "apex_session=" + id } },
    );
    assert.equal(expired.status, 401);
    assert.deepEqual(await expired.json(), { error: "Not connected" });
  }));

const { runInNewContext } = require("node:vm");
const pageScript = (html) => html.match(/<script>([\s\S]*?)<\/script>/)[1];
function memoryStorage(seed = {}, failWrite = false) {
  const data = { ...seed };
  return {
    data,
    getItem: (name) => (name in data ? data[name] : null),
    setItem: (name, value) => {
      if (failWrite) throw new Error("Storage unavailable");
      data[name] = value;
    },
    removeItem: (name) => {
      delete data[name];
    },
  };
}

test("AniList implicit connect page starts a state-bound token grant without a server secret", () =>
  serve(async (base) => {
    const previous = {
      ANILIST_CLIENT_ID: process.env.ANILIST_CLIENT_ID,
      ANILIST_CLIENT_SECRET: process.env.ANILIST_CLIENT_SECRET,
      ANILIST_REDIRECT_URI: process.env.ANILIST_REDIRECT_URI,
    };
    process.env.ANILIST_CLIENT_ID = "public-client";
    delete process.env.ANILIST_CLIENT_SECRET;
    process.env.ANILIST_REDIRECT_URI = origin + "/api/oauth/anilist/callback";
    try {
      const response = await browserFetch(base + "/api/oauth/anilist/implicit");
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /text\/html/);
      const storage = memoryStorage();
      let redirect = "";
      runInNewContext(pageScript(await response.text()), {
        URLSearchParams,
        Date,
        JSON,
        Math,
        Uint8Array,
        localStorage: storage,
        window: {
          crypto: {
            getRandomValues: (bytes) => {
              for (let i = 0; i < bytes.length; i++) bytes[i] = i + 1;
              return bytes;
            },
          },
          location: { replace: (url) => { redirect = url; } },
        },
      });
      const marker = JSON.parse(storage.data.apex_anilist_oauth_state_v1);
      assert.match(marker.state, /^[0-9a-f]{48}$/);
      assert.ok(marker.expiresAt > Date.now() + 590000);
      const authorize = new URL(redirect);
      assert.equal(
        authorize.origin + authorize.pathname,
        "https://anilist.co/api/v2/oauth/authorize",
      );
      assert.equal(authorize.searchParams.get("response_type"), "token");
      assert.equal(authorize.searchParams.get("client_id"), "public-client");
      assert.equal(authorize.searchParams.has("redirect_uri"), false);
      assert.equal(authorize.searchParams.get("state"), marker.state);
      assert.equal(response.headers.get("set-cookie"), null);
    } finally {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  }));

test("AniList implicit callback only stores a fragment token after a matching local login state", () =>
  serve(async (base) => {
    global.fetch = async () => {
      throw new Error("Implicit login must not call a token endpoint");
    };
    const response = await browserFetch(base + "/api/oauth/anilist/callback");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const script = pageScript(await response.text());
    const marker = JSON.stringify({ state: "state-123", expiresAt: Date.now() + 600000 });

    function runFragment(hash, seed = { apex_anilist_oauth_state_v1: marker }, failWrite = false) {
      const storage = memoryStorage(seed, failWrite);
      let redirect = "";
      runInNewContext(script, {
        URLSearchParams,
        Number,
        Date,
        JSON,
        localStorage: storage,
        window: { location: { hash, replace: (url) => { redirect = url; } } },
      });
      return { storage, redirect };
    }

    const before = Date.now();
    const success = runFragment("#access_token=fragment-token&expires_in=3600&state=state-123");
    const saved = JSON.parse(success.storage.data.apex_anilist_token_v1);
    assert.equal(saved.accessToken, "fragment-token");
    assert.ok(saved.expiresAt > before + 3590000);
    assert.ok(saved.expiresAt < Date.now() + 3601000);
    assert.equal(success.redirect, "/?oauth=anilist&result=connected");
    assert.equal(success.storage.data.apex_anilist_oauth_state_v1, undefined);

    const fallback = runFragment("#access_token=fallback-token&expires_in=abc&state=state-123");
    const fallbackSaved = JSON.parse(fallback.storage.data.apex_anilist_token_v1);
    assert.equal(fallbackSaved.accessToken, "fallback-token");
    assert.ok(fallbackSaved.expiresAt > before + 31490000000);
    assert.equal(fallback.redirect, "/?oauth=anilist&result=connected");

    const absentState = runFragment("#access_token=absent-state-token&expires_in=3600");
    const absentSaved = JSON.parse(absentState.storage.data.apex_anilist_token_v1);
    assert.equal(absentSaved.accessToken, "absent-state-token");
    assert.equal(absentState.redirect, "/?oauth=anilist&result=connected");
    assert.equal(absentState.storage.data.apex_anilist_oauth_state_v1, undefined);

    const noMarker = runFragment("#access_token=injected-token&expires_in=3600", {});
    assert.equal(noMarker.storage.data.apex_anilist_token_v1, undefined);
    assert.equal(noMarker.redirect, "/?oauth=anilist&result=failed");

    const mismatched = runFragment("#access_token=injected-token&expires_in=3600&state=attacker");
    assert.equal(mismatched.storage.data.apex_anilist_token_v1, undefined);
    assert.equal(mismatched.redirect, "/?oauth=anilist&result=failed");
    assert.equal(mismatched.storage.data.apex_anilist_oauth_state_v1, undefined);

    const malformed = runFragment("#access_token=not%20a%20token&state=state-123");
    assert.equal(malformed.storage.data.apex_anilist_token_v1, undefined);
    assert.equal(malformed.redirect, "/?oauth=anilist&result=failed");

    const denied = runFragment("#error=access_denied&state=state-123");
    assert.equal(denied.storage.data.apex_anilist_token_v1, undefined);
    assert.equal(denied.redirect, "/?oauth=anilist&result=denied");

    const unwritable = runFragment(
      "#access_token=fragment-token&expires_in=3600&state=state-123",
      { apex_anilist_oauth_state_v1: marker },
      true,
    );
    assert.equal(unwritable.redirect, "/?oauth=anilist&result=failed");
  }));
