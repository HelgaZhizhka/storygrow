import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService, type JwtPayload, type TokenPair } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

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
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const url = new URL('/auth/callback', frontendUrl);
    // Tokens in fragment: never sent to server, not in access logs or Referer headers
    url.hash = `access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}`;
    res.redirect(url.toString());
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body('refreshToken') refreshToken: string): Promise<TokenPair> {
    if (!refreshToken) throw new BadRequestException('refreshToken required');
    return this.auth.exchangeRefreshToken(refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.auth.logout(user.sub);
  }
}
