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
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService, type JwtPayload } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { SseTicketService } from './sse-ticket.service';

const REFRESH_COOKIE_NAME = 'sg_refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const E2E_TEST_GOOGLE_ID = 'e2e-test-fixture';
const E2E_TEST_EMAIL = 'e2e-test@storygrow.test';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly tickets: SseTicketService,
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

  @Post('sse-ticket')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  sseTicket(@CurrentUser() user: JwtPayload): { ticket: string } {
    return { ticket: this.tickets.issue(user) };
  }

  /**
   * Bypasses Google OAuth for release-verification e2e (#155) — double-gated so
   * it can never activate in production even if one check is misconfigured
   * (the exact single-flag failure mode that caused #289's cookie bug).
   */
  @Post('test-login')
  @HttpCode(HttpStatus.OK)
  async testLogin(): Promise<{ accessToken: string; refreshToken: string }> {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new NotFoundException();
    }
    if (this.config.get<string>('E2E_TEST_MODE') !== 'true') {
      throw new NotFoundException();
    }

    const user = await this.auth.validateOrCreateUser({
      googleId: E2E_TEST_GOOGLE_ID,
      email: E2E_TEST_EMAIL,
    });
    await this.auth.ensureTestFixtureSubscription(user.id);
    return this.auth.generateTokens(user.id, user.email, user.role);
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      // sameSite: 'none' requires secure: true unconditionally — browsers silently
      // drop the cookie otherwise (this shipped broken behind a NODE_ENV check that
      // Railway doesn't set by default, so the cookie never saved in production).
      // `localhost` is treated as a secure context by browsers, so this works
      // unmodified in local dev too — no environment-dependent flag to forget.
      secure: true,
      sameSite: 'none',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: '/auth',
    });
  }
}
