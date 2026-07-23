import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

const publicKey = process.env['LANGFUSE_PUBLIC_KEY'];
const secretKey = process.env['LANGFUSE_SECRET_KEY'];

// Safety net only: main.ts's app.enableShutdownHooks() closes the HTTP server
// and drains onModuleDestroy, so the event loop normally empties well before
// this fires. Bounds a hung shutdown so the process can't zombie forever (#292).
const SHUTDOWN_GRACE_MS = 10_000;

let _sdk: NodeSDK | null = null;

if (publicKey && secretKey) {
  _sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey,
        secretKey,
        baseUrl: process.env['LANGFUSE_HOST'] ?? 'http://localhost:3030',
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
}

export const shutdownTelemetry = (): Promise<void> => _sdk?.shutdown() ?? Promise.resolve();
