import { Injectable } from '@nestjs/common';

export type HealthStatus = {
  status: 'ok';
};

@Injectable()
export class HealthService {
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
