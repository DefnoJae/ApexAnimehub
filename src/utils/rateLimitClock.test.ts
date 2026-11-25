import {
  getRateLimitRetryAt,
  parseRateLimitHeaders,
  setRateLimitRetryAt,
} from "./rateLimitClock";

afterEach(() => {
  jest.restoreAllMocks();
  setRateLimitRetryAt(0);
});

test("reads AniList's X-RateLimit-Reset header as an absolute retry time", () => {
  const now = 1_800_000_000_000;
  jest.spyOn(Date, "now").mockReturnValue(now);
  const headers = {
    get: (name: string) =>
      name === "X-RateLimit-Reset" ? String(now / 1000 + 27) : null,
  };
  expect(parseRateLimitHeaders(headers)).toBe(now + 27_000);
});

test("uses Retry-After seconds when X-RateLimit-Reset is missing", () => {
  const now = 1_800_000_000_000;
  jest.spyOn(Date, "now").mockReturnValue(now);
  const headers = { get: (name: string) => (name === "Retry-After" ? "15" : null) };
  expect(parseRateLimitHeaders(headers)).toBe(now + 15_000);
});

test("keeps the later retry time and clears the block when reset", () => {
  const now = Date.now();
  setRateLimitRetryAt(now + 30_000);
  setRateLimitRetryAt(now + 10_000);
  expect(getRateLimitRetryAt()).toBe(now + 30_000);
  setRateLimitRetryAt(0);
  expect(getRateLimitRetryAt()).toBe(0);
});
