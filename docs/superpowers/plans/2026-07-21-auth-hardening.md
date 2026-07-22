# Auth Hardening Implementation Plan (#156)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the refresh token out of `localStorage` into an HttpOnly cookie (closing the XSS → refresh-token-theft risk), and replace the raw access token in the SSE URL with a short-lived, single-use ticket (closing the token-in-logs risk).

**Architecture:** Backend: `AuthController` sets/reads/clears the refresh token via a `Set-Cookie`/`Cookie` header instead of the JSON request/response body; a new in-memory `SseTicketService` issues and consumes one-time tickets; a new plain `SseTicketAuthGuard` (not Passport-based — a random ticket isn't a JWT) replaces the old JWT-in-query-string strategy for the progress SSE endpoint. Frontend: `lib/auth.ts`/`lib/api.ts` stop touching a refresh token entirely (the browser handles it via the cookie); the progress page fetches a ticket before opening its `EventSource`.

**Tech Stack:** NestJS, Express, `cookie-parser` (new dependency, discussed and approved), Next.js, MSW (frontend test mocking, already in use).

## Global Constraints

- No `any`. Business/API endpoints keep bearer-token (`Authorization` header) auth — untouched by this plan; only the refresh-token transport and the SSE auth mechanism change.
- The refresh cookie is named `sg_refresh_token`, `httpOnly: true`, `path: '/auth'`, `sameSite: 'none'`, `secure` true in production / false otherwise (via `NODE_ENV`).
- `AuthService`'s public methods (`generateTokens`, `exchangeRefreshToken`, `logout`) do NOT change — they still return/consume the refresh token as a plain string; only `AuthController` (the HTTP layer) changes how that string travels (cookie vs JSON body).
- SSE ticket TTL is 60 seconds, single-use (consuming a ticket deletes it immediately), stored in-memory (no new Redis/`ioredis` dependency — approved during design review specifically to avoid that).
- Functions ≤30 lines, ≤3 params; files ≤400 lines; no index-as-key in dynamic lists (not touched by this plan, but don't introduce any).

---

### Task 1: Add `cookie-parser` and register it in `main.ts`

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/main.ts`

**Interfaces:**
- Produces: `req.cookies` populated on every backend request — consumed by Task 3.

- [ ] **Step 1: Add the dependency**

In `backend/package.json`, the `dependencies` block currently has (alphabetical order):

```json
    "bullmq": "^5.77.6",
    "csv-parse": "^6.2.1",
```

Insert `cookie-parser` between them:

```json
    "bullmq": "^5.77.6",
    "cookie-parser": "^1.4.7",
    "csv-parse": "^6.2.1",
```

In `devDependencies`, currently:

```json
    "@swc/core": "^1.15.40",
    "@types/express": "^5.0.0",
```

Insert `@types/cookie-parser` between them (alphabetically first among the `@types/*` entries):

```json
    "@swc/core": "^1.15.40",
    "@types/cookie-parser": "^1.4.10",
    "@types/express": "^5.0.0",
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

- [ ] **Step 3: Register the middleware**

`backend/src/main.ts` currently:

```ts
import './instrument';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { AppModule } from './app.module';

const DEFAULT_PORT = 3001;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  // Bind to 0.0.0.0 so the Railway HTTP proxy can reach the container (the Node
  // default binds IPv6-only in the container, which causes a 502). Log the port.
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on 0.0.0.0:${port}`, 'Bootstrap');
}

void bootstrap();
```

Replace with:

```ts
import './instrument';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

const DEFAULT_PORT = 3001;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  // Bind to 0.0.0.0 so the Railway HTTP proxy can reach the container (the Node
  // default binds IPv6-only in the container, which causes a 502). Log the port.
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on 0.0.0.0:${port}`, 'Bootstrap');
}

void bootstrap();
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter backend exec tsc --noEmit
pnpm --filter backend lint
```

Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/pnpm-lock.yaml backend/src/main.ts
git commit -m "chore(backend): add cookie-parser for the refresh-token cookie (#156)"
```

(If `pnpm install` only touched the root `pnpm-lock.yaml`, add that path instead — check `git status` and add whichever lockfile path changed.)

---

### Task 2: `SseTicketService` — issue and consume one-time SSE tickets

**Files:**
- Create: `backend/src/auth/sse-ticket.service.ts`
- Create: `backend/src/auth/sse-ticket.service.spec.ts`
- Modify: `backend/src/auth/auth.module.ts`

**Interfaces:**
- Produces: `SseTicketService.issue(payload: JwtPayload): string`, `SseTicketService.consume(ticket: string): JwtPayload | null` — consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

`backend/src/auth/sse-ticket.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { SseTicketService } from './sse-ticket.service';
import type { JwtPayload } from './auth.service';

const payload: JwtPayload = { sub: 'user-1', email: 'a@b.com', role: 'user' };

describe('SseTicketService', () => {
  let service: SseTicketService;

  beforeEach(async () => {
    jest.useFakeTimers();
    const module = await Test.createTestingModule({
      providers: [SseTicketService],
    }).compile();
    service = module.get(SseTicketService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('issues a ticket that consumes to the original payload', () => {
    const ticket = service.issue(payload);
    expect(service.consume(ticket)).toEqual(payload);
  });

  it('is single-use — a second consume of the same ticket returns null', () => {
    const ticket = service.issue(payload);
    service.consume(ticket);
    expect(service.consume(ticket)).toBeNull();
  });

  it('returns null for a ticket that was never issued', () => {
    expect(service.consume('never-issued')).toBeNull();
  });

  it('expires a ticket after 60 seconds', () => {
    const ticket = service.issue(payload);
    jest.advanceTimersByTime(60_000);
    expect(service.consume(ticket)).toBeNull();
  });

  it('issues distinct tickets for repeated calls', () => {
    const first = service.issue(payload);
    const second = service.issue(payload);
    expect(first).not.toBe(second);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter backend test -- sse-ticket
```

Expected: FAIL — `Cannot find module './sse-ticket.service'`.

- [ ] **Step 3: Implement**

`backend/src/auth/sse-ticket.service.ts`:

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtPayload } from './auth.service';

const TICKET_TTL_MS = 60 * 1000;

/**
 * One-time tickets for SSE authentication (#156): EventSource can't send an
 * Authorization header, and putting the real access token in the URL risks it
 * landing in browser history and proxy/app logs. A ticket is single-use and
 * short-lived, so even if logged it's useless within seconds.
 */
@Injectable()
export class SseTicketService implements OnModuleDestroy {
  private readonly tickets = new Map<string, JwtPayload>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  issue(payload: JwtPayload): string {
    const ticket = randomUUID();
    this.tickets.set(ticket, payload);
    this.timers.set(
      ticket,
      setTimeout(() => {
        this.tickets.delete(ticket);
        this.timers.delete(ticket);
      }, TICKET_TTL_MS),
    );
    return ticket;
  }

  consume(ticket: string): JwtPayload | null {
    const payload = this.tickets.get(ticket);
    if (!payload) return null;

    this.tickets.delete(ticket);
    const timer = this.timers.get(ticket);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(ticket);
    }
    return payload;
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.tickets.clear();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter backend test -- sse-ticket
```

Expected: PASS, 5/5.

- [ ] **Step 5: Register in `AuthModule`**

`backend/src/auth/auth.module.ts` currently:

```ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtSseStrategy } from './strategies/jwt-sse.strategy';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy, JwtSseStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```

Replace with (removes `JwtSseStrategy` — Task 4 deletes that file and replaces it with a plain guard; adds `SseTicketService`):

```ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SseTicketService } from './sse-ticket.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy, SseTicketService],
  exports: [AuthService, JwtModule, SseTicketService],
})
export class AuthModule {}
```

Note: this removes `JwtSseStrategy` from the providers list before Task 4 has deleted its file. That's fine — the file still exists and compiles on its own, it's just no longer registered. Task 4 deletes the file. If you run `tsc`/tests between Task 2 and Task 4, an unused-but-still-present `jwt-sse.strategy.ts` file causes no error (nothing imports it once it's removed from providers here); the app itself would only break if something tried to activate the `'jwt-sse'` Passport strategy at runtime before Task 4 replaces the guard — no such runtime path fires during a `tsc`/unit-test run.

- [ ] **Step 6: Verify**

```bash
pnpm --filter backend exec tsc --noEmit
pnpm --filter backend test -- sse-ticket auth.module
```

Expected: clean; `sse-ticket` 5/5 (no `auth.module.spec.ts` exists today, so that second test-name filter matching zero files is fine — just confirm no error).

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth/sse-ticket.service.ts backend/src/auth/sse-ticket.service.spec.ts backend/src/auth/auth.module.ts
git commit -m "feat(auth): add SseTicketService for one-time SSE authentication (#156)"
```

---

### Task 3: Cookie-based refresh token in `AuthController`

**Files:**
- Modify: `backend/src/auth/auth.controller.ts`
- Modify: `backend/src/auth/auth.controller.spec.ts`

**Interfaces:**
- Consumes: `req.cookies` (Task 1).
- Produces: `POST /auth/refresh` now returns `{ accessToken: string }` (no `refreshToken` in the body) and requires the `sg_refresh_token` cookie instead of a `refreshToken` body field — consumed by Task 5 (frontend).

- [ ] **Step 1: Write the failing tests**

Replace `backend/src/auth/auth.controller.spec.ts` entirely with:

```ts
jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService, type TokenPair } from './auth.service';

const mockAuth = {
  generateTokens: jest.fn<Promise<TokenPair>, [string, string, string]>(),
  exchangeRefreshToken: jest.fn<Promise<TokenPair>, [string]>(),
  logout: jest.fn<Promise<void>, [string]>(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'FRONTEND_URL') return 'http://localhost:3000';
    if (key === 'NODE_ENV') return 'test';
    return undefined;
  }),
};

const tokens: TokenPair = { accessToken: 'at', refreshToken: 'rt' };

function makeRes() {
  return { cookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() } as unknown as {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
    redirect: jest.Mock;
  };
}

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuth },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    controller = module.get(AuthController);
  });

  describe('googleCallback', () => {
    it('redirects with only the access token in the URL fragment', async () => {
      mockAuth.generateTokens.mockResolvedValueOnce(tokens);
      const req = { user: { id: 'user-1', email: 'a@b.com', role: 'user' } } as never;
      const res = makeRes();

      await controller.googleCallback(req, res as never);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('access_token=at'));
      expect(res.redirect).toHaveBeenCalledWith(
        expect.not.stringContaining('refresh_token'),
      );
    });

    it('sets the refresh token as an HttpOnly cookie', async () => {
      mockAuth.generateTokens.mockResolvedValueOnce(tokens);
      const req = { user: { id: 'user-1', email: 'a@b.com', role: 'user' } } as never;
      const res = makeRes();

      await controller.googleCallback(req, res as never);

      expect(res.cookie).toHaveBeenCalledWith(
        'sg_refresh_token',
        'rt',
        expect.objectContaining({ httpOnly: true, path: '/auth', sameSite: 'none' }),
      );
    });
  });

  describe('refresh', () => {
    it('reads the refresh token from the cookie, rotates it, and returns only the access token', async () => {
      mockAuth.exchangeRefreshToken.mockResolvedValueOnce({
        accessToken: 'new-at',
        refreshToken: 'new-rt',
      });
      const req = { cookies: { sg_refresh_token: 'old-rt' } } as never;
      const res = makeRes();

      const result = await controller.refresh(req, res as never);

      expect(mockAuth.exchangeRefreshToken).toHaveBeenCalledWith('old-rt');
      expect(res.cookie).toHaveBeenCalledWith(
        'sg_refresh_token',
        'new-rt',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result).toEqual({ accessToken: 'new-at' });
    });

    it('throws UnauthorizedException when the cookie is missing', async () => {
      const req = { cookies: {} } as never;
      const res = makeRes();

      await expect(controller.refresh(req, res as never)).rejects.toThrow(UnauthorizedException);
      expect(mockAuth.exchangeRefreshToken).not.toHaveBeenCalled();
    });

    it('propagates UnauthorizedException from the service', async () => {
      mockAuth.exchangeRefreshToken.mockRejectedValueOnce(new UnauthorizedException());
      const req = { cookies: { sg_refresh_token: 'bad-rt' } } as never;
      const res = makeRes();

      await expect(controller.refresh(req, res as never)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('calls auth.logout and clears the refresh cookie', async () => {
      mockAuth.logout.mockResolvedValueOnce(undefined);
      const res = makeRes();

      await controller.logout({ sub: 'user-1', email: 'a@b.com', role: 'user' }, res as never);

      expect(mockAuth.logout).toHaveBeenCalledWith('user-1');
      expect(res.clearCookie).toHaveBeenCalledWith('sg_refresh_token', { path: '/auth' });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter backend test -- auth.controller
```

Expected: FAIL — `controller.refresh` still expects a different signature (a `refreshToken: string` argument, not `req`/`res`), and `googleCallback`/`logout` don't call `res.cookie`/`res.clearCookie` yet.

- [ ] **Step 3: Implement**

Replace `backend/src/auth/auth.controller.ts` entirely with:

```ts
import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService, type JwtPayload } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

const REFRESH_COOKIE_NAME = 'sg_refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {
    // Passport redirects to Google — no body needed
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request & { user: { id: string; email: string; role: 'user' | 'admin' } },
    @Res() res: Response,
  ): Promise<void> {
    const tokens = await this.auth.generateTokens(req.user.id, req.user.email, req.user.role);
    this.setRefreshCookie(res, tokens.refreshToken);

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const url = new URL('/auth/callback', frontendUrl);
    // Access token in fragment: never sent to server, not in access logs or Referer
    // headers. The refresh token is no longer here — it's the HttpOnly cookie above.
    url.hash = `access_token=${tokens.accessToken}`;
    res.redirect(url.toString());
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const refreshToken = (req.cookies as Record<string, string | undefined> | undefined)?.[
      REFRESH_COOKIE_NAME
    ];
    if (!refreshToken) throw new UnauthorizedException('No refresh token');

    const tokens = await this.auth.exchangeRefreshToken(refreshToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(user.sub);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'none',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: '/auth',
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter backend test -- auth.controller
```

Expected: PASS, 6/6.

- [ ] **Step 5: Verify the whole backend**

```bash
pnpm --filter backend exec tsc --noEmit
pnpm --filter backend lint
```

Expected: clean. (`auth.service.spec.ts` is untouched by this task and should be unaffected — `AuthService` itself didn't change.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/auth.controller.ts backend/src/auth/auth.controller.spec.ts
git commit -m "feat(auth): move the refresh token to an HttpOnly cookie (#156)"
```

---

### Task 4: SSE ticket-based authentication (backend)

**Files:**
- Delete: `backend/src/auth/strategies/jwt-sse.strategy.ts`
- Delete: `backend/src/auth/guards/jwt-sse-auth.guard.ts`
- Create: `backend/src/auth/guards/sse-ticket-auth.guard.ts`
- Create: `backend/src/auth/guards/sse-ticket-auth.guard.spec.ts`
- Modify: `backend/src/auth/auth.module.ts`
- Modify: `backend/src/auth/auth.controller.ts`
- Modify: `backend/src/auth/auth.controller.spec.ts`
- Modify: `backend/src/books/books.module.ts`
- Modify: `backend/src/books/progress.controller.ts`

**Interfaces:**
- Consumes: `SseTicketService` (Task 2).
- Produces: `POST /auth/sse-ticket` → `{ ticket: string }`; `GET /books/:id/progress?ticket=...` now authenticates via that ticket instead of `?token=<JWT>` — consumed by Task 6 (frontend).

**Important design note:** a ticket is a random UUID, not a JWT — it cannot be validated by `passport-jwt`'s `Strategy` (which cryptographically verifies a JWT signature). This task replaces the old Passport-based `JwtSseStrategy`/`JwtSseAuthGuard` with a plain NestJS `CanActivate` guard that reads the ticket from the query string and calls `SseTicketService.consume()` directly — no new Passport strategy package needed. Because this guard isn't Passport-based, it must be resolved through Nest's own DI, which means (unlike the bearer-token guards used elsewhere in this codebase, which work anywhere via Passport's global strategy registry) `BooksModule` needs to import `AuthModule` for this guard's dependency (`SseTicketService`) to be resolvable where `ProgressController` uses it.

- [ ] **Step 1: Write the failing tests**

`backend/src/auth/guards/sse-ticket-auth.guard.spec.ts`:

```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SseTicketAuthGuard } from './sse-ticket-auth.guard';
import { SseTicketService } from '../sse-ticket.service';
import type { JwtPayload } from '../auth.service';

const payload: JwtPayload = { sub: 'user-1', email: 'a@b.com', role: 'user' };

function makeContext(query: Record<string, unknown>): {
  context: ExecutionContext;
  request: { query: Record<string, unknown>; user?: JwtPayload };
} {
  const request: { query: Record<string, unknown>; user?: JwtPayload } = { query };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('SseTicketAuthGuard', () => {
  let tickets: { consume: jest.Mock };
  let guard: SseTicketAuthGuard;

  beforeEach(() => {
    tickets = { consume: jest.fn() };
    guard = new SseTicketAuthGuard(tickets as unknown as SseTicketService);
  });

  it('throws UnauthorizedException when the ticket query param is missing', () => {
    const { context } = makeContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(tickets.consume).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the ticket is invalid or expired', () => {
    tickets.consume.mockReturnValueOnce(null);
    const { context } = makeContext({ ticket: 'bad-ticket' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('attaches the payload to the request and returns true for a valid ticket', () => {
    tickets.consume.mockReturnValueOnce(payload);
    const { context, request } = makeContext({ ticket: 'good-ticket' });

    expect(guard.canActivate(context)).toBe(true);
    expect(tickets.consume).toHaveBeenCalledWith('good-ticket');
    expect(request.user).toEqual(payload);
  });
});
```

**This task changes `AuthController`'s constructor to take a third parameter (`SseTicketService`).** The existing `beforeEach` in `backend/src/auth/auth.controller.spec.ts` builds the testing module used by every `describe` block in the file (`googleCallback`, `refresh`, `logout`) — once the constructor needs a third dependency, that shared module MUST provide it, or Nest's DI will fail to resolve `AuthController` for every existing test, not just the new one. Update the shared setup, don't work around it.

At the top of `backend/src/auth/auth.controller.spec.ts`, add the import:

```ts
import { SseTicketService } from './sse-ticket.service';
```

Add a mock next to the existing `mockAuth`/`mockConfig` declarations:

```ts
const mockTickets = {
  issue: jest.fn(),
  consume: jest.fn(),
};
```

In the shared `beforeEach`, change:

```ts
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuth },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
```

to:

```ts
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuth },
        { provide: ConfigService, useValue: mockConfig },
        { provide: SseTicketService, useValue: mockTickets },
      ],
    }).compile();
```

Then add a new `describe` block after the existing `describe('logout', ...)` block, using the shared `controller` (built via the module above) like every other test in the file:

```ts
  describe('sseTicket', () => {
    it('issues a ticket for the current user', () => {
      mockTickets.issue.mockReturnValueOnce('generated-ticket');

      const result = controller.sseTicket({ sub: 'user-1', email: 'a@b.com', role: 'user' });

      expect(mockTickets.issue).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'a@b.com',
        role: 'user',
      });
      expect(result).toEqual({ ticket: 'generated-ticket' });
    });
  });
```

Also add `jest.clearAllMocks()` already covers `mockTickets` since it's declared at module scope alongside the others and the existing `beforeEach` already calls `jest.clearAllMocks()` — no extra reset code needed.

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter backend test -- sse-ticket-auth.guard auth.controller
```

Expected: FAIL — `sse-ticket-auth.guard.ts` doesn't exist yet; `AuthController` doesn't have a `sseTicket` method or a third constructor param yet.

- [ ] **Step 3: Delete the old JWT-based SSE strategy and guard**

```bash
rm backend/src/auth/strategies/jwt-sse.strategy.ts
rm backend/src/auth/guards/jwt-sse-auth.guard.ts
```

- [ ] **Step 4: Create the new guard**

`backend/src/auth/guards/sse-ticket-auth.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SseTicketService } from '../sse-ticket.service';
import type { JwtPayload } from '../auth.service';

/**
 * SSE auth via one-time ticket (#156), not the JWT bearer flow used elsewhere:
 * EventSource can't send an Authorization header, and a ticket is a random
 * UUID, not a JWT, so this can't reuse passport-jwt — it's a plain guard.
 */
@Injectable()
export class SseTicketAuthGuard implements CanActivate {
  constructor(private readonly tickets: SseTicketService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const ticket = request.query.ticket;
    if (typeof ticket !== 'string') throw new UnauthorizedException('Missing ticket');

    const payload = this.tickets.consume(ticket);
    if (!payload) throw new UnauthorizedException('Invalid or expired ticket');

    request.user = payload;
    return true;
  }
}
```

- [ ] **Step 5: Add the `POST /auth/sse-ticket` endpoint**

In `backend/src/auth/auth.controller.ts`, add the import and constructor param:

```ts
import { SseTicketService } from './sse-ticket.service';
```

Change the constructor to:

```ts
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly tickets: SseTicketService,
  ) {}
```

Add this method, right after `logout`:

```ts
  @Post('sse-ticket')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  sseTicket(@CurrentUser() user: JwtPayload): { ticket: string } {
    return { ticket: this.tickets.issue(user) };
  }
```

- [ ] **Step 6: Update `AuthModule`**

`backend/src/auth/auth.module.ts` — add `SseTicketAuthGuard` to `providers` and `exports`:

```ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SseTicketService } from './sse-ticket.service';
import { SseTicketAuthGuard } from './guards/sse-ticket-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy, SseTicketService, SseTicketAuthGuard],
  exports: [AuthService, JwtModule, SseTicketService, SseTicketAuthGuard],
})
export class AuthModule {}
```

- [ ] **Step 7: Wire `BooksModule` to import `AuthModule`**

`backend/src/books/books.module.ts` currently:

```ts
import { Module } from '@nestjs/common';
import { S3Module } from '../s3/s3.module';
import { FastFlowModule } from '../fast-flow/fast-flow.module';
import { BookImageService } from './book-image.service';
import { BookProgressService } from './book-progress.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [S3Module, FastFlowModule],
  controllers: [BooksController, ProgressController],
  providers: [BookImageService, BooksService, BookProgressService],
  exports: [BookImageService, BookProgressService],
})
export class BooksModule {}
```

Replace with:

```ts
import { Module } from '@nestjs/common';
import { S3Module } from '../s3/s3.module';
import { FastFlowModule } from '../fast-flow/fast-flow.module';
import { AuthModule } from '../auth/auth.module';
import { BookImageService } from './book-image.service';
import { BookProgressService } from './book-progress.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [S3Module, FastFlowModule, AuthModule],
  controllers: [BooksController, ProgressController],
  providers: [BookImageService, BooksService, BookProgressService],
  exports: [BookImageService, BookProgressService],
})
export class BooksModule {}
```

- [ ] **Step 8: Update `ProgressController`**

In `backend/src/books/progress.controller.ts`, change:

```ts
import { JwtSseAuthGuard } from '../auth/guards/jwt-sse-auth.guard';
```

to:

```ts
import { SseTicketAuthGuard } from '../auth/guards/sse-ticket-auth.guard';
```

and change:

```ts
@Controller()
@UseGuards(JwtSseAuthGuard)
export class ProgressController {
```

to:

```ts
@Controller()
@UseGuards(SseTicketAuthGuard)
export class ProgressController {
```

No other change to this file — the ownership check and event-emission logic are unaffected.

- [ ] **Step 9: Run tests to verify they pass**

```bash
pnpm --filter backend test -- sse-ticket-auth.guard auth.controller
```

Expected: PASS — guard 3/3, controller with the new `sseTicket` test included.

- [ ] **Step 10: Verify the whole backend**

```bash
pnpm --filter backend exec tsc --noEmit
pnpm --filter backend lint
pnpm --filter backend test
```

Expected: all clean/green. Confirm no other file references `JwtSseStrategy` or `JwtSseAuthGuard` (both deleted):

```bash
grep -rn "JwtSseStrategy\|JwtSseAuthGuard" backend/src
```

Expected: no output.

- [ ] **Step 11: Commit**

```bash
git add backend/src/auth backend/src/books/books.module.ts backend/src/books/progress.controller.ts
git status --short  # confirm the two rm'd files show as deleted (D), not untracked
git commit -m "feat(auth): SSE authenticates via a one-time ticket instead of a raw access token in the URL (#156)"
```

---

### Task 5: Frontend — stop storing the refresh token; cookie-based refresh flow

**Files:**
- Modify: `frontend/src/lib/auth.ts`
- Modify: `frontend/src/lib/auth.test.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/app/auth/callback/page.tsx`

**Interfaces:**
- Consumes: `POST /auth/refresh` returning `{ accessToken: string }` and requiring the browser's own cookie jar, not a client-held token (Task 3).
- Produces: `setTokens(accessToken: string): void` (was 2-arg) — every call site in the frontend must be updated to the 1-arg form.

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/lib/auth.test.ts` entirely with:

```ts
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
    global.fetch = originalFetch;
  });

  it('sends credentials so the backend can clear the refresh cookie, then always clears the local token', async () => {
    setTokens('access-123');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    global.fetch = fetchMock;

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
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    const { logout } = await import('./auth');
    await logout();

    expect(getAccessToken()).toBeNull();
  });
});
```

Create `frontend/src/lib/api.test.ts`:

```ts
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
    window.location = { ...originalLocation, href: '' } as Location;

    const { api } = await import('./api');
    const { ApiError } = await import('./api');
    await expect(api.get('/books')).rejects.toThrow(ApiError);

    expect(getAccessToken()).toBeNull();
    expect(window.location.href).toBe('/login');

    window.location = originalLocation;
  });

  afterEach(() => {
    clearTokens();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter frontend test -- auth.test api.test
```

Expected: FAIL — `setTokens` still requires 2 arguments; `api.ts` still reads a refresh token from `localStorage` and posts it in the request body instead of relying on `credentials: 'include'`.

- [ ] **Step 3: Implement `lib/auth.ts`**

Replace `frontend/src/lib/auth.ts` entirely with:

```ts
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
```

- [ ] **Step 4: Implement `lib/api.ts`**

Replace `frontend/src/lib/api.ts` entirely with:

```ts
import { getAccessToken, setTokens, clearTokens } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshPromise: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    clearTokens();
    window.location.href = '/login';
    throw new ApiError(401, 'Session expired');
  }

  const data = (await res.json()) as { accessToken: string };
  setTokens(data.accessToken);
}

async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401 && !isRetry) {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    await refreshPromise;
    return request<T>(path, init, true);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

- [ ] **Step 5: Update the OAuth callback page**

`frontend/src/app/auth/callback/page.tsx` currently:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setTokens } from '@/lib/auth';

export default function AuthCallbackPage(): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      setTokens(accessToken, refreshToken);
      router.replace('/books');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Выполняется вход…</p>
    </main>
  );
}
```

Replace the `useEffect` body (only) with:

```tsx
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');

    if (accessToken) {
      setTokens(accessToken);
      router.replace('/books');
    } else {
      router.replace('/login');
    }
  }, [router]);
```

(Everything else in the file — imports, the returned JSX — is unchanged.)

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm --filter frontend test -- auth.test api.test
```

Expected: PASS — `auth.test.ts` all green, `api.test.ts` 2/2.

- [ ] **Step 7: Verify the whole frontend**

```bash
pnpm --filter frontend exec tsc --noEmit
pnpm --filter frontend lint
pnpm --filter frontend test
```

Expected: all clean/green. Confirm no remaining call site passes a second argument to `setTokens` or calls `getRefreshToken`:

```bash
grep -rn "getRefreshToken\|setTokens(.*,.*)" frontend/src
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/auth.ts frontend/src/lib/auth.test.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/app/auth/callback/page.tsx
git commit -m "feat(auth): frontend stops storing the refresh token, relies on the HttpOnly cookie (#156)"
```

---

### Task 6: Frontend — progress page fetches an SSE ticket

**Files:**
- Modify: `frontend/src/app/(app)/books/[id]/progress/page.tsx`

**Interfaces:**
- Consumes: `POST /auth/sse-ticket` → `{ ticket: string }` (Task 4).

- [ ] **Step 1: Implement**

In `frontend/src/app/(app)/books/[id]/progress/page.tsx`, remove the now-unused import:

```tsx
import { getAccessToken } from '@/lib/auth';
```

(delete this line entirely — nothing else in the file uses `getAccessToken` after this change).

Replace this block:

```tsx
    void checkStatus().then(() => {
      if (settled) return;

      // EventSource cannot send Authorization headers — pass token as query param.
      const token = getAccessToken();
      const qs = token ? `?token=${encodeURIComponent(token)}` : '';
      const es = new EventSource(`${API_URL}/books/${id}/progress${qs}`);
      esRef.current = es;
```

with:

```tsx
    void checkStatus().then(async () => {
      if (settled) return;

      // EventSource cannot send Authorization headers — exchange the access
      // token for a short-lived, single-use ticket instead of putting the
      // real token in the URL (#156).
      let qs = '';
      try {
        const { ticket } = await api.post<{ ticket: string }>('/auth/sse-ticket', {});
        qs = `?ticket=${encodeURIComponent(ticket)}`;
      } catch {
        /* fall through without a ticket — the backend will reject the connection
           and the existing polling fallback below still resolves the terminal state */
      }
      if (settled) return;

      const es = new EventSource(`${API_URL}/books/${id}/progress${qs}`);
      esRef.current = es;
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter frontend exec tsc --noEmit
pnpm --filter frontend lint
```

Expected: clean.

- [ ] **Step 3: Manual check (this page has no existing automated test — see plan's Global Constraints; not adding one here keeps this task's scope matched to the rest of the file, which is also untested today)**

Run the app locally (`pnpm --filter backend dev` + `pnpm --filter frontend dev`), log in, create a fast-flow book, and confirm the progress page still shows live updates (SSE connects using `?ticket=`, not `?token=`) and still resolves to the book page on completion. If SSE doesn't deliver events in your environment (the existing code comment notes Railway's proxy sometimes doesn't), confirm the 4-second polling fallback still carries you to the terminal state — this doesn't depend on the ticket at all, so it should be unaffected either way.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/'(app)'/books/'[id]'/progress/page.tsx
git commit -m "feat(auth): progress page uses a one-time SSE ticket instead of the raw access token in the URL (#156)"
```

---

### Task 7: Full verification and progress log

**Files:**
- Modify: `progress.md`

- [ ] **Step 1: Run the full smoke check**

```bash
./init.sh
```

Expected: `Smoke check PASSED`.

- [ ] **Step 2: Manual end-to-end check**

Log in via Google OAuth against a real (or local) backend, confirm: `sg_refresh_token` cookie is set (HttpOnly — won't show in `document.cookie`, but visible in DevTools → Application → Cookies) and no `refresh_token` appears in `localStorage` or in the URL after the `/auth/callback` redirect. Force a 401 (e.g. wait out the 15-minute access-token expiry, or manually clear the access token in DevTools) and confirm a request still succeeds via the silent refresh. Log out and confirm the cookie is cleared.

- [ ] **Step 3: Add a progress.md entry**

Summarize: #156 shipped (refresh token → HttpOnly cookie; SSE → one-time ticket instead of the access token in the URL); note the new `cookie-parser` dependency; note that `AuthService` itself didn't change, only `AuthController`'s HTTP-layer transport; note the `SseTicketAuthGuard` is the first non-Passport guard in this codebase and required `BooksModule` to import `AuthModule` for DI resolution, unlike the existing bearer-token guards.

- [ ] **Step 4: Commit**

```bash
git add progress.md
git commit -m "docs(progress): session entry — #156 auth hardening"
```
