import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    if (req.user?.role !== 'admin') throw new ForbiddenException();
    return true;
  }
}
