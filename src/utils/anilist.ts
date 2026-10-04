export async function fetchAnilist<T>(query: string, variables: Record<string, unknown> = {}, signal?: AbortSignal, token?: string): Promise<T> {
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
    if (!response.ok) throw new Error(response.status === 429 ? 'AniList rate limit reached. Please try again later.' : 'AniList request failed (' + response.status + ')');
    const payload: { data?: T; errors?: Array<{ message: string }> } = await response.json();
    if (payload.errors?.length) throw new Error(payload.errors.map(e => e.message).join('; '));
    if (!payload.data) throw new Error('AniList returned no data');
    return payload.data;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
