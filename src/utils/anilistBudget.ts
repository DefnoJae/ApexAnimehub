export interface AniListBudgetDeps {
  now: () => number;
  wait: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface AniListBudget {
  acquire(signal?: AbortSignal): Promise<void>;
}

const WINDOW_MS = 60_000;
const MAX_STARTS = 24;
const MIN_SPACING_MS = 1_000;

function abortError(): DOMException {
  if (typeof DOMException === "function")
    return new DOMException("Aborted", "AbortError");
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error as DOMException;
}

function defaultWait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function createAniListBudget(
  deps: Partial<AniListBudgetDeps> = {},
): AniListBudget {
  const now = deps.now ?? Date.now;
  const wait = deps.wait ?? defaultWait;
  const starts: number[] = [];
  let tail: Promise<void> = Promise.resolve();

  function prune(current: number): void {
    while (starts.length && starts[0] <= current - WINDOW_MS) starts.shift();
  }

  async function schedule(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw abortError();
    while (true) {
      const current = now();
      prune(current);
      const windowDelay =
        starts.length >= MAX_STARTS
          ? starts[0] + WINDOW_MS - current
          : 0;
      const last = starts[starts.length - 1];
      const spacingDelay =
        last === undefined ? 0 : Math.max(0, last + MIN_SPACING_MS - current);
      const delay = Math.max(0, windowDelay, spacingDelay);
      await wait(delay, signal);
      if (signal?.aborted) throw abortError();
      const startedAt = now();
      prune(startedAt);
      if (starts.length >= MAX_STARTS) continue;
      starts.push(startedAt);
      return;
    }
  }

  return {
    acquire(signal?: AbortSignal): Promise<void> {
      if (signal?.aborted) return Promise.reject(abortError());
      const pending = tail.then(() => schedule(signal));
      tail = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    },
  };
}

const productionBudget = createAniListBudget();

export function acquireAniListRequest(signal?: AbortSignal): Promise<void> {
  return productionBudget.acquire(signal);
}
