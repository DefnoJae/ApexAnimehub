const rateLimitMessage = "AniList rate limit reached. Please try again later.";
let publicRetryAt = 0;

export async function fetchAnilist<T>(query: string, variables: Record<string, unknown> = {}, signal?: AbortSignal, token?: string): Promise<T> {
  if (!token && Date.now() < publicRetryAt) throw new Error(rateLimitMessage);
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
      throw new Error(rateLimitMessage);
    }
    if (!response.ok) throw new Error('AniList request failed (' + response.status + ')');
    const payload: { data?: T; errors?: Array<{ message: string }> } = await response.json();
    if (payload.errors?.length) throw new Error(payload.errors.map(e => e.message).join('; '));
    if (!payload.data) throw new Error('AniList returned no data');
    return payload.data;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
