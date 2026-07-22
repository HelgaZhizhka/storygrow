import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SseTicketService } from '../sse-ticket.service';
import type { JwtPayload } from '../auth.service';

/**
 * SSE auth via one-time ticket (#156), not the JWT bearer flow used elsewhere:
 * EventSource can't send an Authorization header, and a ticket is a random
 * UUID, not a JWT, so this can't reuse passport-jwt — it's a plain guard.
 */
@Injectable()
export class SseTicketAuthGuard implements CanActivate {
  constructor(private readonly tickets: SseTicketService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const ticket = request.query.ticket;
    if (typeof ticket !== 'string') throw new UnauthorizedException('Missing ticket');

    const payload = this.tickets.consume(ticket);
    if (!payload) throw new UnauthorizedException('Invalid or expired ticket');

    request.user = payload;
    return true;
  }
}
