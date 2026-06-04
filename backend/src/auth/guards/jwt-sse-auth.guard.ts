import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtSseAuthGuard extends AuthGuard('jwt-sse') {}
