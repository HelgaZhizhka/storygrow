import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

const publicKey = process.env['LANGFUSE_PUBLIC_KEY'];
const secretKey = process.env['LANGFUSE_SECRET_KEY'];

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

  process.on('SIGTERM', () => void _sdk?.shutdown());
  process.on('SIGINT', () => void _sdk?.shutdown());
}

export const shutdownTelemetry = (): Promise<void> => _sdk?.shutdown() ?? Promise.resolve();
