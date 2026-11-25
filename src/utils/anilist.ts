import { acquireAniListRequest } from "./anilistBudget";
import { getRateLimitRetryAt, parseRateLimitHeaders, setRateLimitRetryAt } from "./rateLimitClock";

export const ANILIST_RATE_LIMIT_MESSAGE = "AniList rate limit reached. Please try again later.";

export function isRateLimitError(value: unknown): boolean {
  if (typeof value === "string") return isRateLimitMessage(value);
  if (!value || typeof value !== "object") return false;
  if ((value as { status?: unknown }).status === 429) return true;
  return value instanceof Error && isRateLimitMessage(value.message);
}

function isRateLimitMessage(message: string): boolean {
  return message.includes("429") || message.includes(ANILIST_RATE_LIMIT_MESSAGE);
}

export class AniListRequestError extends Error {
  status?: number;
  graphqlErrors: string[];

  constructor(message: string, status?: number, graphqlErrors: string[] = []) {
    super(message);
    this.name = "AniListRequestError";
    this.status = status;
    this.graphqlErrors = graphqlErrors;
  }
}

export async function fetchAnilist<T>(query: string, variables: Record<string, unknown> = {}, signal?: AbortSignal, token?: string): Promise<T> {
  if (getRateLimitRetryAt() > Date.now()) throw new AniListRequestError(ANILIST_RATE_LIMIT_MESSAGE, 429);
  await acquireAniListRequest(signal);
  if (getRateLimitRetryAt() > Date.now()) throw new AniListRequestError(ANILIST_RATE_LIMIT_MESSAGE, 429);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({ query, variables }),
    });
    if (response.status === 429) {
      const resetAt = parseRateLimitHeaders(response.headers);
      setRateLimitRetryAt(resetAt ?? Date.now() + 60000);
      throw new AniListRequestError(ANILIST_RATE_LIMIT_MESSAGE, 429);
    }
    if (!response.ok) {
      let graphqlErrors: string[] = [];
      try {
        const payload: { errors?: Array<{ message: string }> } = await response.json();
        if (Array.isArray(payload?.errors)) {
          graphqlErrors = payload.errors.map(e => e.message).filter(Boolean);
        }
      } catch {
        // ignore JSON parse failures; use the existing message
      }
      if (graphqlErrors.length) {
        throw new AniListRequestError(graphqlErrors.join('; '), response.status, graphqlErrors);
      }
      throw new AniListRequestError('AniList request failed (' + response.status + ')', response.status);
    }
    const payload: { data?: T; errors?: Array<{ message: string }> } = await response.json();
    if (payload.errors?.length) {
      const messages = payload.errors.map(e => e.message);
      throw new AniListRequestError(messages.join('; '), response.status, messages);
    }
    if (!payload.data) throw new AniListRequestError('AniList returned no data', response.status);
    return payload.data;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
