# Auth Hardening Design (#156)

## Goal

Close two auth risks flagged by an external code review before public launch: the refresh token sits in `localStorage`, so an XSS bug would let an attacker steal a 7-day-lived session; and SSE connections carry the real access token in the URL's query string, which can land in browser history, proxy logs, and app logs.

## Approach

Scoped fix, not a full move to cookie-based sessions. Business endpoints keep bearer-token auth (`Authorization` header) — that's CSRF-immune by construction (a cross-site form/fetch can't attach a custom header without a CORS preflight our origin allowlist blocks), so it stays untouched. Only the two flagged surfaces change:

1. The refresh token moves to an HttpOnly cookie — inaccessible to JS, so XSS can no longer read it out of `localStorage`.
2. SSE gets a short-lived, single-use ticket instead of the raw access token in the URL.

A full cookie-session model (both tokens in cookies, all endpoints cookie-authenticated) was considered and rejected for now: it would require CSRF middleware and ideally a shared registrable domain between the API and web app for `SameSite=Lax/Strict` (the current Railway subdomains — `*.up.railway.app` — are different "sites" for cookie purposes, so cross-origin cookies there need `SameSite=None`). That's a bigger, separate piece of work; this design gets the two named risks closed without it.

## Backend

### Refresh token → HttpOnly cookie

- `AuthController.googleCallback`: unchanged for the access token (still redirects with `#access_token=...` in the URL fragment, read client-side, never sent to the server). The refresh token is no longer placed in the fragment — instead set directly via `res.cookie('sg_refresh_token', tokens.refreshToken, { httpOnly: true, secure: <see below>, sameSite: 'none', maxAge: <refresh TTL in ms>, path: '/auth' })` on the same redirect response, before calling `res.redirect(...)`.
- `secure`: `true` in production; `false` when `NODE_ENV !== 'production'` so local HTTP dev still works (modern browsers generally treat `localhost` as a secure context even over plain HTTP, but making this explicit via config is more portable than relying on that browser-specific carve-out).
- `path: '/auth'` scopes the cookie so it's only ever sent to `/auth/*` endpoints (refresh, logout) — it has no reason to go to `/books`, `/billing`, etc.
- `AuthController.refresh`: no longer takes `refreshToken` from the request body. Reads it from `req.cookies['sg_refresh_token']` instead (needs `cookie-parser` middleware registered in `main.ts` — a new but tiny, well-known Express dependency; NOT `ioredis` or anything larger). Throws `UnauthorizedException` if the cookie is missing (mirrors today's `BadRequestException` for a missing body field, but `Unauthorized` fits better since a missing cookie means "not logged in," not "bad request"). On success, sets the *rotated* refresh token via the same `res.cookie(...)` call and returns `{ accessToken }` only — the refresh token is never in the JSON response body again.
- `AuthController.logout`: adds `@Res({ passthrough: true }) res: Response` and calls `res.clearCookie('sg_refresh_token', { path: '/auth' })` alongside the existing DB hash clear.
- `main.ts`: register `cookie-parser` (`app.use(cookieParser())`). CORS already has `credentials: true` and an origin allowlist — unaffected, both are required for cross-origin cookies to work at all and are already in place.

### SSE one-time ticket

- New in-memory service `SseTicketService` (mirrors `StaleBooksSweeperService`'s existing simple in-process pattern — no new dependency): `Map<string, JwtPayload>`, each entry expiring after 60 seconds via its own `setTimeout` (not a periodic sweep — tickets are meant to be consumed almost immediately, a per-entry timer is simpler than a sweep loop for this).
  - `issue(payload: JwtPayload): string` — generates a random ticket (`crypto.randomUUID()`), stores it, schedules its own expiry, returns it.
  - `consume(ticket: string): JwtPayload | null` — looks up and immediately deletes the entry (single-use), returns `null` if not found/expired.
- New endpoint `POST /auth/sse-ticket`, guarded by the existing `JwtAuthGuard` (so it requires a valid bearer access token, same as any other authenticated endpoint) — returns `{ ticket: string }` from `SseTicketService.issue(user)`.
- `JwtSseStrategy` (or a new dedicated strategy — implementation detail for the plan) changes to extract `ticket` from the query string instead of `token`, and validates it by calling `SseTicketService.consume(ticket)` instead of verifying it as a JWT — if `consume` returns `null`, authentication fails (401). The strategy needs `SseTicketService` injected.
- `ProgressController`'s `@Sse('books/:id/progress')` endpoint and its guard swap accordingly — no change to the endpoint's own logic (ownership check, status-based event emission), only to how the connection authenticates.

## Frontend

- `lib/auth.ts`: remove `REFRESH_TOKEN_KEY`, `getRefreshToken()`, and the `refreshToken` parameter from `setTokens()` — it becomes `setTokens(accessToken: string)`. `clearTokens()` no longer removes a refresh-token key (nothing to remove — it's not in localStorage anymore).
- `lib/api.ts`: `refreshAccessToken()` calls `POST /auth/refresh` with `credentials: 'include'`, no request body; reads only `{ accessToken }` from the response and calls the updated `setTokens(accessToken)`.
- `app/auth/callback/page.tsx`: only reads `access_token` from the URL fragment now (the refresh token was removed from the fragment on the backend side, so this naturally simplifies — no code change needed beyond what already ignores a now-absent second param, though the plan should double check this page doesn't error if `refresh_token` is absent from the hash).
- `logout()` in `lib/auth.ts`: unchanged in spirit (still calls `POST /auth/logout` and clears local state) — the backend now also clears the cookie, no frontend change needed for that half.
- New: before opening the `EventSource` on the progress page, call `POST /auth/sse-ticket` (existing bearer-token pattern, via the `api` client) to get a ticket, then use `?ticket=<value>` instead of `?token=<access_token>` in the `EventSource` URL.

## Testing

- Backend: `AuthService`/`AuthController` unit tests for the cookie-based refresh flow (cookie set/read/rotated/cleared, missing-cookie → 401); `SseTicketService` unit tests (issue → consume returns payload once, second consume returns null, expiry after TTL — use fake timers); `JwtSseStrategy` (or its replacement) unit test for ticket-based auth success/failure.
- Frontend: update existing `auth`/`api` tests for the new `setTokens` signature and the cookie-based refresh call; no new component needed for the SSE ticket fetch (small, inline addition to the existing progress page).

## Out of scope

- Full cookie-based session model for all endpoints (see rejected alternative above) — tracked as a possible future issue if a custom domain is ever set up.
- Moving the access token out of `localStorage` — its 15-minute lifetime already bounds exposure; the issue's named risk is specifically the 7-day refresh token.
- CSRF middleware — not needed because business endpoints stay bearer-token-authenticated.
