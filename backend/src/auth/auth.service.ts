import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/client';

export interface GoogleProfile {
  googleId: string;
  email: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'user' | 'admin';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_EXPIRY_SECONDS = 15 * 60;
const REFRESH_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateOrCreateUser(
    profile: GoogleProfile,
  ): Promise<{ id: string; email: string; role: 'user' | 'admin' }> {
    const existing = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
      select: { id: true, email: true, role: true },
    });
    if (existing) return existing;

    return this.prisma.user.upsert({
      where: { email: profile.email },
      create: { email: profile.email, googleId: profile.googleId },
      update: { googleId: profile.googleId },
      select: { id: true, email: true, role: true },
    });
  }

  async generateTokens(userId: string, email: string, role: 'user' | 'admin'): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: ACCESS_EXPIRY_SECONDS,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_EXPIRY_SECONDS,
      }),
    ]);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: this.hashToken(refreshToken) },
    });

    return { accessToken, refreshToken };
  }

  async exchangeRefreshToken(rawRefreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(rawRefreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, refreshToken: true },
    });
    if (!user?.refreshToken) throw new UnauthorizedException();
    if (user.refreshToken !== this.hashToken(rawRefreshToken)) throw new UnauthorizedException();

    return this.generateTokens(user.id, user.email, user.role);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  /**
   * Gives the e2e-test fixture user (#155) an active premium subscription so
   * repeated local/CI test runs never hit the free-tier quota (1 book/30 days) —
   * without this, the second run against a persistent DB always 402s.
   */
  async ensureTestFixtureSubscription(userId: string): Promise<void> {
    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeSubscriptionId: 'e2e-test-fixture-subscription',
        plan: SubscriptionPlan.premium,
        status: SubscriptionStatus.active,
        periodEnd: new Date('2099-01-01'),
      },
      update: {
        status: SubscriptionStatus.active,
        periodEnd: new Date('2099-01-01'),
      },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
