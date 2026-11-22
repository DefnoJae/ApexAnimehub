import { fetchAnilist } from "./anilist";

export const ANILIST_TOKEN_KEY = "apex_anilist_token_v1";
export const ANILIST_AUTH_INVALID_EVENT = "apex:anilist-auth-invalid";

export interface AniListToken {
  accessToken: string;
  expiresAt: number;
  identity?: string;
  name?: string;
}

export class AniListAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AniListAuthError";
  }
}

function isAuthInvalidError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: number; graphqlErrors?: unknown };
  if (candidate.status === 401) return true;
  return Array.isArray(candidate.graphqlErrors)
    && candidate.graphqlErrors.some((message) => typeof message === "string" && /invalid token/i.test(message));
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
      name: typeof parsed.name === "string" && parsed.name ? parsed.name : undefined,
    };
  } catch {
    return null;
  }
}

export function hasAniListToken(): boolean {
  const token = readAniListToken();
  return !!token && token.expiresAt > Date.now() + 60000;
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

async function verifyIdentity(
  accessToken: string,
  expectedIdentity: string | undefined,
  signal?: AbortSignal,
): Promise<{ identity: string; name: string }> {
  const viewer = await fetchAnilist<{ Viewer: { id: number; name: string } }>(
    "query{Viewer{id name}}",
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
  const viewerName = viewer?.Viewer?.name;
  const name = typeof viewerName === "string" && viewerName.trim()
    ? viewerName
    : identity;
  return { identity, name };
}

async function rehydrateToken(signal?: AbortSignal): Promise<AniListToken> {
  let response: Response;
  try {
    response = await fetch("/api/oauth/anilist/token", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    // Transport failures (network blip, AbortError) are not auth failures; leave stored
    // state intact and allow a later call to retry rehydration.
    tokenPromise = null;
    throw error;
  }

  if (!response) {
    tokenPromise = null;
    throw new Error("No response from AniList token endpoint");
  }
  if (response.status === 401) {
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

  let verified: { identity: string; name: string };
  try {
    verified = await verifyIdentity(payload.accessToken, payload.identity, signal);
  } catch (error) {
    if (error instanceof AniListAuthError || isAuthInvalidError(error)) {
      invalidateAniListAuth();
      if (error instanceof AniListAuthError) throw error;
      throw new AniListAuthError("AniList connection required. Please reconnect.");
    }
    throw error;
  }

  const token: AniListToken = {
    accessToken: payload.accessToken,
    expiresAt: payload.expiresAt,
    identity: verified.identity,
    name: verified.name,
  };
  writeAniListToken(token);
  return token;
}

async function verifyStoredToken(
  token: AniListToken,
  signal?: AbortSignal,
): Promise<AniListToken> {
  let verified: { identity: string; name: string };
  try {
    verified = await verifyIdentity(token.accessToken, token.identity, signal);
  } catch (error) {
    if (error instanceof AniListAuthError || isAuthInvalidError(error)) {
      invalidateAniListAuth();
      if (error instanceof AniListAuthError) throw error;
      throw new AniListAuthError("AniList connection required. Please reconnect.");
    }
    tokenPromise = null;
    throw error;
  }
  const next: AniListToken = {
    ...token,
    identity: verified.identity,
    name: verified.name,
  };
  writeAniListToken(next);
  return next;
}

export async function getAniListToken(signal?: AbortSignal): Promise<AniListToken> {
  if (tokenPromise) {
    const token = await tokenPromise;
    if (token.expiresAt > Date.now() + 60000 && token.identity) {
      return token;
    }
    tokenPromise = null;
  }
  const stored = readAniListToken();
  tokenPromise =
    stored && stored.expiresAt > Date.now() + 60000
      ? verifyStoredToken(stored, signal)
      : rehydrateToken(signal);
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
    if (isAuthInvalidError(error)) {
      invalidateAniListAuth();
      throw new AniListAuthError("AniList authorization expired. Please reconnect.");
    }
    throw error;
  }
}
