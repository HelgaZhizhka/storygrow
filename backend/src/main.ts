import './instrument';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

const DEFAULT_PORT = 3001;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);
}

void bootstrap();
