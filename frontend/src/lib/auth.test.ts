import { getAccessToken, setTokens, clearTokens, isAuthenticated, getUserEmail } from './auth';

/** Builds a syntactically valid (unsigned) JWT with the given payload, for tests only. */
const fakeJwt = (payload: object): string => {
  const base64url = (obj: object): string =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'none' })}.${base64url(payload)}.`;
};

describe('auth utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no token is stored', () => {
    expect(getAccessToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('stores and retrieves the access token', () => {
    setTokens('access-123');
    expect(getAccessToken()).toBe('access-123');
    expect(isAuthenticated()).toBe(true);
  });

  it('clearTokens removes the access token', () => {
    setTokens('access-123');
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('setTokens overwrites an existing token', () => {
    setTokens('old-access');
    setTokens('new-access');
    expect(getAccessToken()).toBe('new-access');
  });
});

describe('getUserEmail', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no token is stored', () => {
    expect(getUserEmail()).toBeNull();
  });

  it('decodes the email claim from a stored access token', () => {
    setTokens(fakeJwt({ sub: 'user-1', email: 'maria@example.com', role: 'user' }));
    expect(getUserEmail()).toBe('maria@example.com');
  });

  it('returns null when the token has no payload segment', () => {
    setTokens('not-a-jwt');
    expect(getUserEmail()).toBeNull();
  });

  it('returns null instead of throwing when the payload segment is not valid base64/JSON', () => {
    setTokens('header.!!!not-base64-or-json!!!.signature');
    expect(getUserEmail()).toBeNull();
  });

  it('returns null when the token has no email claim', () => {
    setTokens(fakeJwt({ sub: 'user-1', role: 'user' }));
    expect(getUserEmail()).toBeNull();
  });
});

describe('logout', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch);
  });

  it('sends credentials so the backend can clear the refresh cookie, then always clears the local token', async () => {
    setTokens('access-123');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const { logout } = await import('./auth');
    await logout();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(getAccessToken()).toBeNull();
  });

  it('still clears the local token even if the backend call fails', async () => {
    setTokens('access-123');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { logout } = await import('./auth');
    await logout();

    expect(getAccessToken()).toBeNull();
  });
});
