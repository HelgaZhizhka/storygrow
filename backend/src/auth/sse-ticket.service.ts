import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtPayload } from './auth.service';

const TICKET_TTL_MS = 60 * 1000;

/**
 * One-time tickets for SSE authentication (#156): EventSource can't send an
 * Authorization header, and putting the real access token in the URL risks it
 * landing in browser history and proxy/app logs. A ticket is single-use and
 * short-lived, so even if logged it's useless within seconds.
 */
@Injectable()
export class SseTicketService implements OnModuleDestroy {
  private readonly tickets = new Map<string, JwtPayload>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  issue(payload: JwtPayload): string {
    const ticket = randomUUID();
    this.tickets.set(ticket, payload);
    this.timers.set(
      ticket,
      setTimeout(() => {
        this.tickets.delete(ticket);
        this.timers.delete(ticket);
      }, TICKET_TTL_MS),
    );
    return ticket;
  }

  consume(ticket: string): JwtPayload | null {
    const payload = this.tickets.get(ticket);
    if (!payload) return null;

    this.tickets.delete(ticket);
    const timer = this.timers.get(ticket);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(ticket);
    }
    return payload;
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.tickets.clear();
  }
}
