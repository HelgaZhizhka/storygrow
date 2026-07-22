const ACCESS_TOKEN_KEY = 'sg_access_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return localStorage;
}

export function getAccessToken(): string | null {
  return storage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function setTokens(accessToken: string): void {
  const s = storage();
  if (!s) return;
  s.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function clearTokens(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(ACCESS_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

/** Reads the `email` claim out of the stored access token, for display only — not verified. */
export function getUserEmail(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const decoded = JSON.parse(json) as { email?: string };
    return decoded.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Logs out on the backend (best-effort — clears the HttpOnly refresh cookie
 * server-side, which requires `credentials: 'include'` since frontend and
 * backend are cross-origin) and always clears the local access token.
 */
export async function logout(): Promise<void> {
  const token = getAccessToken();
  if (token) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    }).catch(() => {});
  }
  clearTokens();
}
