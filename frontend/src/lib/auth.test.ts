import { getAccessToken, getRefreshToken, setTokens, clearTokens, isAuthenticated } from './auth';

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
