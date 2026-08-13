import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { Logger } from '@nestjs/common';

const publicKey = process.env['LANGFUSE_PUBLIC_KEY'];
const secretKey = process.env['LANGFUSE_SECRET_KEY'];

// Nest's DI-provided logger doesn't exist yet — main.ts imports this module
// before NestFactory.create — but the static Logger works standalone and keeps
// the format consistent with the rest of boot. No auto-instrumentations are
// registered below, so importing @nestjs/common ahead of _sdk.start() is safe.
const LOGGER_CONTEXT = 'Telemetry';

// Safety net only: main.ts's app.enableShutdownHooks() closes the HTTP server
// and drains onModuleDestroy, so the event loop normally empties well before
// this fires. Bounds a hung shutdown so the process can't zombie forever (#292).
const SHUTDOWN_GRACE_MS = 10_000;

let _sdk: NodeSDK | null = null;

if (publicKey && secretKey) {
  const baseUrl = process.env['LANGFUSE_HOST'] ?? 'http://localhost:3030';

  _sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey,
        secretKey,
        baseUrl,
        environment: process.env['NODE_ENV'] ?? 'development',
      }),
    ],
  });

  _sdk.start();

  const shutdown = (): void => {
    void _sdk?.shutdown().finally(() => {
      setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  Logger.log(`LangFuse tracing enabled → ${baseUrl}`, LOGGER_CONTEXT);
} else {
  // This branch used to be silent, which hid a month of missing traces: the
  // dev/start scripts had no dotenv preload, so this module ran before
  // ConfigModule loaded .env and always took the no-keys path (#339).
  Logger.warn(
    'LangFuse tracing DISABLED — LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY missing from the process environment. No traces and no eval telemetry will be recorded.',
    LOGGER_CONTEXT,
  );
}

export const shutdownTelemetry = (): Promise<void> => _sdk?.shutdown() ?? Promise.resolve();
