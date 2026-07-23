jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  SubscriptionPlan: { free: 'free', premium: 'premium' },
  SubscriptionStatus: {
    active: 'active',
    canceled: 'canceled',
    past_due: 'past_due',
    trialing: 'trialing',
  },
}));

import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService, type GoogleProfile } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  subscription: {
    upsert: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn(),
  verify: jest.fn(),
};

const configValues: Record<string, string> = {
  JWT_SECRET: 'test-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_ACCESS_EXPIRES: '15m',
  JWT_REFRESH_EXPIRES: '7d',
};

const mockConfig = {
  get: jest.fn((key: string) => configValues[key]),
  getOrThrow: jest.fn((key: string) => configValues[key]),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('validateOrCreateUser', () => {
    const profile: GoogleProfile = { googleId: 'gid-1', email: 'test@example.com' };

    it('returns existing user if found by googleId', async () => {
      const existing = { id: 'user-1', email: 'test@example.com' };
      mockPrisma.user.findUnique.mockResolvedValueOnce(existing);

      const result = await service.validateOrCreateUser(profile);
      expect(result).toEqual(existing);
      expect(mockPrisma.user.upsert).not.toHaveBeenCalled();
    });

    it('upserts user if not found by googleId', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const created = { id: 'user-2', email: 'test@example.com' };
      mockPrisma.user.upsert.mockResolvedValueOnce(created);

      const result = await service.validateOrCreateUser(profile);
      expect(result).toEqual(created);
      expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
        where: { email: profile.email },
        create: { email: profile.email, googleId: profile.googleId },
        update: { googleId: profile.googleId },
        select: { id: true, email: true, role: true },
      });
    });
  });

  describe('generateTokens', () => {
    it('signs access and refresh tokens and stores hashed refresh token', async () => {
      mockJwt.signAsync.mockResolvedValueOnce('access-tok').mockResolvedValueOnce('refresh-tok');
      mockPrisma.user.update.mockResolvedValueOnce({});

      const result = await service.generateTokens('user-1', 'test@example.com', 'user');

      expect(result).toEqual({ accessToken: 'access-tok', refreshToken: 'refresh-tok' });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshToken: hash('refresh-tok') },
      });
    });
  });

  describe('exchangeRefreshToken', () => {
    it('throws UnauthorizedException if jwt.verify throws', async () => {
      mockJwt.verify.mockImplementationOnce(() => {
        throw new Error('expired');
      });
      await expect(service.exchangeRefreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException if user has no stored refresh token', async () => {
      mockJwt.verify.mockReturnValueOnce({ sub: 'user-1', email: 'a@b.com' });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        refreshToken: null,
      });
      await expect(service.exchangeRefreshToken('some-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException if stored hash does not match', async () => {
      mockJwt.verify.mockReturnValueOnce({ sub: 'user-1', email: 'a@b.com' });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        refreshToken: hash('different-token'),
      });
      await expect(service.exchangeRefreshToken('my-token')).rejects.toThrow(UnauthorizedException);
    });

    it('issues new token pair on valid refresh token', async () => {
      const rawToken = 'valid-refresh';
      mockJwt.verify.mockReturnValueOnce({ sub: 'user-1', email: 'a@b.com' });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        refreshToken: hash(rawToken),
      });
      mockJwt.signAsync.mockResolvedValueOnce('new-access').mockResolvedValueOnce('new-refresh');
      mockPrisma.user.update.mockResolvedValueOnce({});

      const result = await service.exchangeRefreshToken(rawToken);
      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
    });
  });

  describe('logout', () => {
    it('clears refreshToken in DB', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({});
      await service.logout('user-1');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshToken: null },
      });
    });
  });

  describe('ensureTestFixtureSubscription', () => {
    it('upserts an active premium subscription for the given user', async () => {
      mockPrisma.subscription.upsert.mockResolvedValueOnce({});

      await service.ensureTestFixtureSubscription('e2e-user-1');

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith({
        where: { userId: 'e2e-user-1' },
        create: {
          userId: 'e2e-user-1',
          stripeSubscriptionId: 'e2e-test-fixture-subscription',
          plan: 'premium',
          status: 'active',
          periodEnd: new Date('2099-01-01'),
        },
        update: {
          status: 'active',
          periodEnd: new Date('2099-01-01'),
        },
      });
    });
  });
});
