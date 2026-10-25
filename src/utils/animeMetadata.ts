// Same public metadata sources used by SeaKit; no Seanime runtime or MAL scraping.
const DUB_URL =
  "https://raw.githubusercontent.com/Joelis57/MyDubList/refs/heads/main/dubs/confidence/normal/dubbed_english.json";
interface Cached<T> {
  value: T;
  at: number;
}
function read<T>(key: string): Cached<T> | null {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ value, at: Date.now() }));
  } catch {}
}
let dubRequest: Promise<{ dubbed: number[]; partial: number[] }> | undefined;
export function getDubIndex() {
  if (!dubRequest)
    dubRequest = (async () => {
      const cached = read<{ dubbed: number[]; partial: number[] }>(
        "apex_dubs_v1",
      );
      if (cached && Date.now() - cached.at < 86400000) return cached.value;
      try {
        const response = await fetch(DUB_URL, {
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error("Dub source unavailable");
        const data = await response.json();
        const valid = (values: unknown): number[] =>
          Array.isArray(values)
            ? values
                .map(Number)
                .filter((id) => Number.isSafeInteger(id) && id > 0)
            : [];
        if (!Array.isArray(data) && !Array.isArray(data.dubbed))
          throw new Error("Invalid dub dataset");
        const value = {
          dubbed: valid(Array.isArray(data) ? data : data.dubbed),
          partial: valid(data.partial),
        };
        save("apex_dubs_v1", value);
        return value;
      } catch (error) {
        if (cached) return cached.value;
        dubRequest = undefined;
        throw error;
      }
    })();
  return dubRequest;
}
let queue: Promise<unknown> = Promise.resolve();
const pending = new Map<number, Promise<number | null>>();
export function getMalScore(id: number): Promise<number | null> {
  if (pending.has(id)) return pending.get(id)!;
  const key = "apex_mal_score_v1_" + id,
    cached = read<number | null>(key);
  if (cached && Date.now() - cached.at < 86400000)
    return Promise.resolve(cached.value);
  const request = queue
    .catch(() => {})
    .then(async () => {
      try {
        const response = await fetch("https://api.jikan.moe/v4/anime/" + id, {
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error("MAL rating unavailable");
        const payload = await response.json(),
          score = payload.data?.score;
        const value =
          typeof score === "number" && score > 0 && score <= 10 ? score : null;
        save(key, value);
        return value;
      } catch {
        return cached?.value ?? null;
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 1100));
        pending.delete(id);
      }
    });
  queue = request;
  pending.set(id, request);
  return request;
}
