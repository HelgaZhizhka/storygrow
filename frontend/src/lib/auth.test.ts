import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  isAuthenticated,
  getUserEmail,
} from './auth';

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

  it('returns null when no tokens are stored', () => {
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('stores and retrieves tokens', () => {
    setTokens('access-123', 'refresh-456');
    expect(getAccessToken()).toBe('access-123');
    expect(getRefreshToken()).toBe('refresh-456');
    expect(isAuthenticated()).toBe(true);
  });

  it('clearTokens removes both tokens', () => {
    setTokens('access-123', 'refresh-456');
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('setTokens overwrites existing tokens', () => {
    setTokens('old-access', 'old-refresh');
    setTokens('new-access', 'new-refresh');
    expect(getAccessToken()).toBe('new-access');
    expect(getRefreshToken()).toBe('new-refresh');
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
    setTokens(fakeJwt({ sub: 'user-1', email: 'maria@example.com', role: 'user' }), 'refresh');
    expect(getUserEmail()).toBe('maria@example.com');
  });

  it('returns null for a malformed token instead of throwing', () => {
    setTokens('not-a-jwt', 'refresh');
    expect(getUserEmail()).toBeNull();
  });

  it('returns null when the token has no email claim', () => {
    setTokens(fakeJwt({ sub: 'user-1', role: 'user' }), 'refresh');
    expect(getUserEmail()).toBeNull();
  });
});
