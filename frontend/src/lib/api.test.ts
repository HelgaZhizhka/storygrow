import { http, HttpResponse } from 'msw';
import { server } from '../../tests/mocks/server';
import { setTokens, getAccessToken, clearTokens } from './auth';

const API_URL = 'http://localhost:3001';

describe('api refresh flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retries the original request with a new access token after a 401 triggers a refresh', async () => {
    setTokens('expired-access');
    let protectedCallCount = 0;

    server.use(
      http.get(`${API_URL}/books`, () => {
        protectedCallCount += 1;
        if (protectedCallCount === 1) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json([{ id: 'book-1' }]);
      }),
      http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json({ accessToken: 'new-access' })),
    );

    const { api } = await import('./api');
    const result = await api.get<{ id: string }[]>('/books');

    expect(result).toEqual([{ id: 'book-1' }]);
    expect(getAccessToken()).toBe('new-access');
    expect(protectedCallCount).toBe(2);
  });

  it('clears the local token and redirects to /login when refresh itself fails', async () => {
    setTokens('expired-access');
    server.use(
      http.get(`${API_URL}/books`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
    );

    const originalLocation = window.location;
    // @ts-expect-error -- jsdom/happy-dom allow reassigning window.location for this kind of test
    delete window.location;
    // @ts-expect-error -- the DOM lib's location setter only types `string`; this test needs the full Location object
    window.location = { ...originalLocation, href: '' } as Location;

    const { api } = await import('./api');
    const { ApiError } = await import('./api');
    await expect(api.get('/books')).rejects.toThrow(ApiError);

    expect(getAccessToken()).toBeNull();
    expect(window.location.href).toBe('/login');

    // @ts-expect-error -- see above
    window.location = originalLocation;
  });

  afterEach(() => {
    clearTokens();
  });
});
