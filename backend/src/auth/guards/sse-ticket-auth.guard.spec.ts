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
