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
  return { cookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };
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
      expect(res.redirect).toHaveBeenCalledWith(expect.not.stringContaining('refresh_token'));
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
