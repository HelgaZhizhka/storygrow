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
