// mock ./anilist so getAniListToken's Viewer verification is deterministic
jest.mock("./anilist", () => ({
  ...jest.requireActual("./anilist"),
  fetchAnilist: jest.fn(),
}));
import {
  ANILIST_RATE_LIMIT_MESSAGE,
  AniListRequestError,
  fetchAnilist,
  isRateLimitError,
} from "./anilist";
import {
  ANILIST_AUTH_INVALID_EVENT,
  ANILIST_TOKEN_KEY,
  AniListAuthError,
  anilistRequest,
  clearAniListToken,
  getAniListToken,
  invalidateAniListAuth,
  readAniListToken,
} from "./anilistAuth";

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  invalidateAniListAuth(); // clears in-memory rehydration promise between tests
});

describe("AniList rate-limit detection", () => {
  test("exports the canonical rate-limit message", () => {
    expect(ANILIST_RATE_LIMIT_MESSAGE).toBe(
      "AniList rate limit reached. Please try again later.",
    );
  });

  test.each([
    ["exact message", ANILIST_RATE_LIMIT_MESSAGE],
    ["message containing 429", "AniList request failed (429)"],
    ["Error with the rate-limit message", new Error(ANILIST_RATE_LIMIT_MESSAGE)],
    [
      "request error with status 429",
      new AniListRequestError(ANILIST_RATE_LIMIT_MESSAGE, 429),
    ],
    ["plain object with status 429", { status: 429 }],
  ])("isRateLimitError recognises %s", (_label, value) => {
    expect(isRateLimitError(value)).toBe(true);
  });

  test.each([
    ["ordinary message", "Network request failed"],
    ["ordinary error", new Error("Network request failed")],
    ["unrelated object", { status: 500 }],
    ["null", null],
    ["undefined", undefined],
  ])("isRateLimitError rejects %s", (_label, value) => {
    expect(isRateLimitError(value)).toBe(false);
  });
});

test("getAniListToken rehydrates from the token endpoint and verifies Viewer identity", async () => {
  localStorage.setItem(ANILIST_TOKEN_KEY, JSON.stringify({
    accessToken: "old-token",
    expiresAt: Date.now() + 3600000,
    identity: "1",
  }));
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      accessToken: "new-token",
      expiresAt: Date.now() + 3600000,
    }),
  });
  (fetchAnilist as jest.Mock).mockResolvedValue({ Viewer: { id: 77, name: "Alice" } });
  const token = await getAniListToken();
  expect(token).toMatchObject({
    accessToken: "new-token",
    identity: "77",
    name: "Alice",
  });
  expect(readAniListToken()).toMatchObject({
    accessToken: "new-token",
    identity: "77",
    name: "Alice",
  });
  expect(fetchAnilist).toHaveBeenCalledWith(
    expect.stringContaining("Viewer{id name}"),
    {},
    undefined,
    "new-token",
  );
  expect(global.fetch).toHaveBeenCalledWith("/api/oauth/anilist/token", {
    credentials: "same-origin",
    cache: "no-store",
    signal: undefined,
  });
});

test("getAniListToken reuses the in-page rehydrated token without another endpoint call", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      accessToken: "token-from-session",
      expiresAt: Date.now() + 3600000,
    }),
  });
  (fetchAnilist as jest.Mock).mockResolvedValue({ Viewer: { id: 77, name: "Alice" } });
  await getAniListToken();
  await getAniListToken();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith("/api/oauth/anilist/token", {
    credentials: "same-origin",
    cache: "no-store",
    signal: undefined,
  });
});

test("getAniListToken rejects and invalidates when token endpoint is 401", async () => {
  localStorage.setItem(ANILIST_TOKEN_KEY, JSON.stringify({
    accessToken: "stale-token",
    expiresAt: Date.now() - 1,
    identity: "1",
  }));
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: "Not connected" }),
  });
  await expect(getAniListToken()).rejects.toBeInstanceOf(AniListAuthError);
  expect(readAniListToken()).toBeNull();
});

test("anilistRequest invalidates on HTTP 401 or Invalid token GraphQL errors", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      accessToken: "valid-token",
      expiresAt: Date.now() + 3600000,
      identity: "77",
    }),
  });
  (fetchAnilist as jest.Mock)
    .mockResolvedValueOnce({ Viewer: { id: 77, name: "Alice" } })
    .mockRejectedValueOnce(Object.assign(new Error("Invalid token"), {
      status: 400,
      graphqlErrors: ["Invalid token"],
    }));
  localStorage.setItem(ANILIST_TOKEN_KEY, JSON.stringify({
    accessToken: "valid-token",
    expiresAt: Date.now() + 3600000,
    identity: "77",
  }));
  const listener = jest.fn();
  window.addEventListener(ANILIST_AUTH_INVALID_EVENT, listener);
  await expect(anilistRequest("query { Viewer { id } }")).rejects.toThrow(
    "AniList authorization expired. Please reconnect.",
  );
  // Proves rehydration succeeded and the request reached the mocked GraphQL-error branch.
  expect(fetchAnilist).toHaveBeenCalledTimes(2);
  expect(fetchAnilist).toHaveBeenNthCalledWith(
    2,
    "query { Viewer { id } }",
    {},
    undefined,
    "valid-token",
  );
  expect(readAniListToken()).toBeNull();
  expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener(ANILIST_AUTH_INVALID_EVENT, listener);
});

test("getAniListToken treats token-endpoint transport failures as retryable without invalidating auth", async () => {
  const abortError = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  const controller = new AbortController();
  global.fetch = jest.fn()
    .mockRejectedValueOnce(abortError)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: "retry-token", expiresAt: Date.now() + 3600000 }),
    });
  (fetchAnilist as jest.Mock).mockResolvedValue({ Viewer: { id: 77, name: "Alice" } });
  localStorage.setItem(ANILIST_TOKEN_KEY, JSON.stringify({
    accessToken: "original-token",
    expiresAt: Date.now() + 3600000,
    identity: "1",
  }));
  const listener = jest.fn();
  window.addEventListener(ANILIST_AUTH_INVALID_EVENT, listener);

  await expect(getAniListToken(controller.signal)).rejects.toBe(abortError);
  expect(listener).not.toHaveBeenCalled();
  expect(readAniListToken()).toMatchObject({ accessToken: "original-token" });

  const token = await getAniListToken(controller.signal);
  expect(token).toMatchObject({ accessToken: "retry-token", identity: "77" });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(global.fetch).toHaveBeenNthCalledWith(2, "/api/oauth/anilist/token", {
    credentials: "same-origin",
    cache: "no-store",
    signal: controller.signal,
  });
  expect(listener).not.toHaveBeenCalled();
  window.removeEventListener(ANILIST_AUTH_INVALID_EVENT, listener);
});

const verificationAuthFailures: Array<[string, Error]> = [
  ["HTTP 401", Object.assign(new Error("Unauthorized"), { status: 401 })],
  ["Invalid token GraphQL error", Object.assign(new Error("Invalid token"), { status: 400, graphqlErrors: ["Invalid token"] })],
];

test.each(verificationAuthFailures)(
  "getAniListToken invalidates when identity verification fails with %s",
  async (_label, verificationError) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: "rejected-token",
        expiresAt: Date.now() + 3600000,
      }),
    });
    (fetchAnilist as jest.Mock).mockRejectedValueOnce(verificationError);
    localStorage.setItem(ANILIST_TOKEN_KEY, JSON.stringify({
      accessToken: "previous-token",
      expiresAt: Date.now() + 3600000,
      identity: "1",
    }));
    const listener = jest.fn();
    window.addEventListener(ANILIST_AUTH_INVALID_EVENT, listener);

    await expect(getAniListToken()).rejects.toBeInstanceOf(AniListAuthError);
    expect(readAniListToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(ANILIST_AUTH_INVALID_EVENT, listener);
  },
);
