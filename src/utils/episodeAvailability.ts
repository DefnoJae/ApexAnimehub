export interface EpisodeAvailability {
  sub: number[];
  dub: number[];
  at: number;
}
const cache = new Map<number, EpisodeAvailability>();
export async function fetchEpisodeAvailability(
  id: number,
  signal?: AbortSignal,
): Promise<EpisodeAvailability> {
  const saved = cache.get(id);
  if (saved && Date.now() - saved.at < 300000) return saved;
  const response = await fetch("https://ani.pm/api/partner/v1/series/" + id, {
    signal: signal || AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error("Episode availability is temporarily unavailable.");
  const { data } = await response.json();
  if (Number(data?.anilistId) !== id || !Array.isArray(data.episodeList))
    throw new Error("Episode availability could not be verified.");
  const rows = data.episodeList.filter(
    (row: { number: number }) =>
      Number.isSafeInteger(row.number) && row.number > 0,
  );
  const numbers = (lang: "sub" | "dub") =>
    Array.from(
      new Set<number>(
        rows
          .filter(
            (row: { available?: { sub?: boolean; dub?: boolean } }) =>
              row.available?.[lang] === true,
          )
          .map((row: { number: number }) => row.number),
      ),
    ).sort((a, b) => a - b);
  const result = { sub: numbers("sub"), dub: numbers("dub"), at: Date.now() };
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(id, result);
  return result;
}
