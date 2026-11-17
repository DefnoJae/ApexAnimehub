import { fetchAnilist } from "./anilist";

export const ANILIST_TOKEN_KEY = "apex_anilist_token_v1";
export const ANILIST_AUTH_INVALID_EVENT = "apex:anilist-auth-invalid";

export interface AniListToken {
  accessToken: string;
  expiresAt: number;
  identity?: string;
}

export class AniListAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AniListAuthError";
  }
}

let tokenPromise: Promise<AniListToken> | null = null;

export function readAniListToken(): AniListToken | null {
  try {
    const raw = localStorage.getItem(ANILIST_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.accessToken !== "string" || typeof parsed.expiresAt !== "number") {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      expiresAt: parsed.expiresAt,
      identity: typeof parsed.identity === "string" && parsed.identity ? parsed.identity : undefined,
    };
  } catch {
    return null;
  }
}

export function writeAniListToken(token: AniListToken): void {
  try {
    localStorage.setItem(ANILIST_TOKEN_KEY, JSON.stringify(token));
  } catch {
    // storage unavailable
  }
}

export function clearAniListToken(): void {
  tokenPromise = null;
  try {
    localStorage.removeItem(ANILIST_TOKEN_KEY);
  } catch {
    // storage unavailable
  }
}

export function invalidateAniListAuth(): void {
  clearAniListToken();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ANILIST_AUTH_INVALID_EVENT));
  }
}

async function verifyIdentity(accessToken: string, expectedIdentity: string | undefined, signal?: AbortSignal): Promise<string> {
  const viewer = await fetchAnilist<{ Viewer: { id: number } }>(
    "query{Viewer{id}}",
    {},
    signal,
    accessToken,
  );
  const identity = String(viewer?.Viewer?.id ?? "");
  if (!identity || identity === "undefined" || identity === "NaN") {
    throw new AniListAuthError("AniList connection required. Please reconnect.");
  }
  if (expectedIdentity && String(expectedIdentity) !== identity) {
    throw new AniListAuthError("AniList connection required. Please reconnect.");
  }
  return identity;
}

async function rehydrateToken(signal?: AbortSignal): Promise<AniListToken> {
  let response: Response;
  try {
    response = await fetch("/api/oauth/anilist/token", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch {
    invalidateAniListAuth();
    throw new AniListAuthError("AniList connection required. Please reconnect.");
  }

  if (!response || response.status === 401) {
    invalidateAniListAuth();
    throw new AniListAuthError("AniList connection required. Please reconnect.");
  }
  if (!response.ok) {
    throw new Error("Failed to load AniList token");
  }

  let payload: { accessToken?: string; expiresAt?: number; identity?: string };
  try {
    payload = await response.json();
  } catch {
    invalidateAniListAuth();
    throw new AniListAuthError("AniList connection required. Please reconnect.");
  }

  if (!payload?.accessToken || typeof payload.expiresAt !== "number") {
    invalidateAniListAuth();
    throw new AniListAuthError("AniList connection required. Please reconnect.");
  }

  let identity: string;
  try {
    identity = await verifyIdentity(payload.accessToken, payload.identity, signal);
  } catch (error) {
    if (error instanceof AniListAuthError) invalidateAniListAuth();
    throw error;
  }

  const token: AniListToken = {
    accessToken: payload.accessToken,
    expiresAt: payload.expiresAt,
    identity,
  };
  writeAniListToken(token);
  return token;
}

export async function getAniListToken(signal?: AbortSignal): Promise<AniListToken> {
  if (tokenPromise) {
    const token = await tokenPromise;
    if (token.expiresAt > Date.now() + 60000 && token.identity) {
      return token;
    }
    tokenPromise = null;
  }
  tokenPromise = rehydrateToken(signal);
  try {
    return await tokenPromise;
  } catch (error) {
    if (!(error instanceof AniListAuthError)) {
      tokenPromise = null;
    }
    throw error;
  }
}

export async function anilistRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  const token = await getAniListToken(signal);
  try {
    return await fetchAnilist<T>(query, variables ?? {}, signal, token.accessToken);
  } catch (error) {
    const status = (error as { status?: number })?.status;
    const graphqlErrors = (error as { graphqlErrors?: string[] })?.graphqlErrors ?? [];
    if (status === 401 || graphqlErrors.some((message) => /invalid token/i.test(message))) {
      invalidateAniListAuth();
      throw new AniListAuthError("AniList authorization expired. Please reconnect.");
    }
    throw error;
  }
}
