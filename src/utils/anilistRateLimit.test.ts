import { ANILIST_RATE_LIMIT_MESSAGE, fetchAnilist } from "./anilist";
import { getRateLimitRetryAt, setRateLimitRetryAt } from "./rateLimitClock";

afterEach(() => {
  jest.restoreAllMocks();
  setRateLimitRetryAt(0);
});

function limitedHeaders(seconds: number) {
  const now = 1_800_000_000_000;
  jest.spyOn(Date, "now").mockReturnValue(now);
  return {
    get: (name: string) =>
      name === "X-RateLimit-Reset" ? String(now / 1000 + seconds) : null,
  };
}

test("publishes the reset time from an authenticated 429 so the UI can count down", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 429,
    headers: limitedHeaders(25),
    json: async () => ({}),
  } as unknown as Response);
  await expect(
    fetchAnilist("query {}", {}, undefined, "token-from-session"),
  ).rejects.toThrow(ANILIST_RATE_LIMIT_MESSAGE);
  expect(getRateLimitRetryAt()).toBe(1_800_000_000_000 + 25_000);
});

test("blocks every caller while the shared cooldown is active", async () => {
  jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
  setRateLimitRetryAt(1_800_000_000_000 + 30_000);
  global.fetch = jest.fn() as jest.Mock;
  await expect(
    fetchAnilist("query {}", {}, undefined, "token-from-session"),
  ).rejects.toThrow(ANILIST_RATE_LIMIT_MESSAGE);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("a successful response leaves the shared cooldown untouched", async () => {
  const now = 1_800_000_000_000;
  jest.spyOn(Date, "now").mockReturnValue(now);
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: limitedHeaders(12),
    json: async () => ({ data: {} }),
  } as unknown as Response);
  await fetchAnilist("query {}", {}, undefined, "token-from-session");
  expect(getRateLimitRetryAt()).toBe(0);
});
