// mock ./anilist so getAniListToken's Viewer verification is deterministic
jest.mock("./anilist", () => ({ fetchAnilist: jest.fn() }));
import { fetchAnilist } from "./anilist";
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
  (fetchAnilist as jest.Mock).mockResolvedValue({ Viewer: { id: 77 } });
  const token = await getAniListToken();
  expect(token).toMatchObject({ accessToken: "new-token", identity: "77" });
  expect(readAniListToken()).toMatchObject({ accessToken: "new-token", identity: "77" });
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
  (fetchAnilist as jest.Mock).mockResolvedValue({ Viewer: { id: 77 } });
  await getAniListToken();
  await getAniListToken();
  expect(global.fetch).toHaveBeenCalledTimes(1);
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
    .mockResolvedValueOnce({ Viewer: { id: 77 } })
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
