jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService, type TokenPair } from './auth.service';

const mockAuth = {
  generateTokens: jest.fn<Promise<TokenPair>, [string, string]>(),
  exchangeRefreshToken: jest.fn<Promise<TokenPair>, [string]>(),
  logout: jest.fn<Promise<void>, [string]>(),
};

const mockConfig = {
  get: jest.fn((key: string) => (key === 'FRONTEND_URL' ? 'http://localhost:3000' : undefined)),
};

const tokens: TokenPair = { accessToken: 'at', refreshToken: 'rt' };

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
    it('redirects to /auth/callback with tokens in URL fragment', async () => {
      mockAuth.generateTokens.mockResolvedValueOnce(tokens);
      const req = { user: { id: 'user-1', email: 'a@b.com' } } as never;
      const redirectMock = jest.fn();
      const res = { redirect: redirectMock } as never;

      await controller.googleCallback(req, res);

      expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining('access_token=at'));
      expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining('refresh_token=rt'));
    });
  });

  describe('refresh', () => {
    it('delegates to auth.exchangeRefreshToken and returns new tokens', async () => {
      mockAuth.exchangeRefreshToken.mockResolvedValueOnce(tokens);
      const result = await controller.refresh('old-rt');
      expect(mockAuth.exchangeRefreshToken).toHaveBeenCalledWith('old-rt');
      expect(result).toEqual(tokens);
    });

    it('throws BadRequestException when refreshToken is missing', () => {
      expect(() => controller.refresh('')).toThrow(BadRequestException);
      expect(mockAuth.exchangeRefreshToken).not.toHaveBeenCalled();
    });

    it('propagates UnauthorizedException from service', async () => {
      mockAuth.exchangeRefreshToken.mockRejectedValueOnce(new UnauthorizedException());
      await expect(controller.refresh('bad-rt')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('calls auth.logout with userId from JWT payload', async () => {
      mockAuth.logout.mockResolvedValueOnce(undefined);
      await controller.logout({ sub: 'user-1', email: 'a@b.com', role: 'user' });
      expect(mockAuth.logout).toHaveBeenCalledWith('user-1');
    });
  });
});
