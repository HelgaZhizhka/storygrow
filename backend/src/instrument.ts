import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

const publicKey = process.env['LANGFUSE_PUBLIC_KEY'];
const secretKey = process.env['LANGFUSE_SECRET_KEY'];

if (publicKey && secretKey) {
  const sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey,
        secretKey,
        baseUrl: process.env['LANGFUSE_HOST'] ?? 'http://localhost:3030',
        environment: process.env['NODE_ENV'] ?? 'development',
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => void sdk.shutdown());
  process.on('SIGINT', () => void sdk.shutdown());
}
