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
