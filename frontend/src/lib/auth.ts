const ACCESS_TOKEN_KEY = 'sg_access_token';
const REFRESH_TOKEN_KEY = 'sg_refresh_token';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return localStorage;
}

export function getAccessToken(): string | null {
  return storage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function getRefreshToken(): string | null {
  return storage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
}

export function setTokens(accessToken: string, refreshToken: string): void {
  const s = storage();
  if (!s) return;
  s.setItem(ACCESS_TOKEN_KEY, accessToken);
  s.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(ACCESS_TOKEN_KEY);
  s.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}
