export function randomToken(bytes = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
export function beginOAuth(provider: string): string {
  const state = randomToken();
  sessionStorage.setItem(provider + '_oauth', JSON.stringify({ state, createdAt: Date.now() }));
  return state;
}
export function validateOAuth(provider: string, state: string): void {
  const key = provider + '_oauth';
  const raw = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  const saved = raw ? JSON.parse(raw) : null;
  if (!state || !saved || saved.state !== state || Date.now() - saved.createdAt > 600000) throw new Error('Invalid or expired OAuth state');
}
