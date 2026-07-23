import './instrument';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

const DEFAULT_PORT = 3001;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Without this, SIGTERM/SIGINT never trigger onModuleDestroy (the
  // sweeper/ticket-cleanup intervals keep the event loop alive forever), so
  // Railway's SIGTERM-then-SIGKILL redeploy always falls through to a hard
  // kill instead of a graceful HTTP-drain + cleanup (#292).
  app.enableShutdownHooks();
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  // Bind to 0.0.0.0 so the Railway HTTP proxy can reach the container (the Node
  // default binds IPv6-only in the container, which causes a 502). Log the port.
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on 0.0.0.0:${port}`, 'Bootstrap');
}

void bootstrap();
