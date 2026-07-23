jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService, type TokenPair } from './auth.service';
import { SseTicketService } from './sse-ticket.service';

const mockAuth = {
  generateTokens: jest.fn<Promise<TokenPair>, [string, string, string]>(),
  exchangeRefreshToken: jest.fn<Promise<TokenPair>, [string]>(),
  logout: jest.fn<Promise<void>, [string]>(),
  validateOrCreateUser: jest.fn(),
  ensureTestFixtureSubscription: jest.fn(),
};

const configValues: Record<string, string | undefined> = {
  FRONTEND_URL: 'http://localhost:3000',
  NODE_ENV: 'test',
};

const mockConfig = {
  get: jest.fn((key: string) => configValues[key]),
};

const mockTickets = {
  issue: jest.fn(),
  consume: jest.fn(),
};

const tokens: TokenPair = { accessToken: 'at', refreshToken: 'rt' };

function makeRes() {
  return { cookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };
}

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    configValues.NODE_ENV = 'test';
    configValues.E2E_TEST_MODE = undefined;
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuth },
        { provide: ConfigService, useValue: mockConfig },
        { provide: SseTicketService, useValue: mockTickets },
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

  describe('testLogin', () => {
    const fixtureUser = {
      id: 'e2e-user-1',
      email: 'e2e-test@storygrow.test',
      role: 'user' as const,
    };

    it('issues real tokens for the fixture user when E2E_TEST_MODE is enabled outside production', async () => {
      configValues.E2E_TEST_MODE = 'true';
      mockAuth.validateOrCreateUser.mockResolvedValueOnce(fixtureUser);
      mockAuth.ensureTestFixtureSubscription.mockResolvedValueOnce(undefined);
      mockAuth.generateTokens.mockResolvedValueOnce(tokens);

      const result = await controller.testLogin();

      expect(mockAuth.validateOrCreateUser).toHaveBeenCalledWith({
        googleId: 'e2e-test-fixture',
        email: 'e2e-test@storygrow.test',
      });
      expect(mockAuth.ensureTestFixtureSubscription).toHaveBeenCalledWith(fixtureUser.id);
      expect(mockAuth.generateTokens).toHaveBeenCalledWith(
        fixtureUser.id,
        fixtureUser.email,
        fixtureUser.role,
      );
      expect(result).toEqual(tokens);

      const validateOrder = mockAuth.validateOrCreateUser.mock.invocationCallOrder[0];
      const ensureOrder = mockAuth.ensureTestFixtureSubscription.mock.invocationCallOrder[0];
      const generateOrder = mockAuth.generateTokens.mock.invocationCallOrder[0];
      expect(validateOrder).toBeLessThan(ensureOrder);
      expect(ensureOrder).toBeLessThan(generateOrder);
    });

    it('throws NotFoundException when E2E_TEST_MODE is not set', async () => {
      configValues.E2E_TEST_MODE = undefined;

      await expect(controller.testLogin()).rejects.toThrow(NotFoundException);
      expect(mockAuth.validateOrCreateUser).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when NODE_ENV is production, even if E2E_TEST_MODE is true', async () => {
      configValues.E2E_TEST_MODE = 'true';
      configValues.NODE_ENV = 'production';

      await expect(controller.testLogin()).rejects.toThrow(NotFoundException);
      expect(mockAuth.validateOrCreateUser).not.toHaveBeenCalled();
    });
  });
});
