const rateLimitMessage = "AniList rate limit reached. Please try again later.";
let publicRetryAt = 0;

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
  if (!token && Date.now() < publicRetryAt) throw new AniListRequestError(rateLimitMessage, 429);
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
      if (!token) {
        const retry = response.headers?.get("Retry-After");
        const now = Date.now();
        const next = retry && /^\d+$/.test(retry) ? now + Number(retry) * 1000 : Date.parse(retry || "");
        publicRetryAt = Math.max(publicRetryAt, next > now ? next : now + 60000);
      }
      throw new AniListRequestError(rateLimitMessage, 429);
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
