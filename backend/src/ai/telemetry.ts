export const createTelemetry = (
  functionId: string,
  metadata: Record<string, string | number | boolean>,
) => ({
  isEnabled: process.env['LANGFUSE_ENABLED'] !== 'false',
  functionId,
  metadata,
});
