describe('instrument (SIGTERM/SIGINT shutdown)', () => {
  const ORIGINAL_ENV = process.env;

  // jest.resetModules() gives instrument.ts a fresh copy of @nestjs/common, so
  // the spy has to target the Logger from the *current* registry — a top-level
  // import would be a different class and never see the call.
  const spyOnLogger = (method: 'log' | 'warn'): jest.SpyInstance => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Logger } = require('@nestjs/common') as typeof import('@nestjs/common');
    return jest.spyOn(Logger, method).mockImplementation(() => undefined);
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, LANGFUSE_PUBLIC_KEY: 'pk', LANGFUSE_SECRET_KEY: 'sk' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('registers exactly one SIGTERM and one SIGINT handler that shuts telemetry down and schedules a bounded, unref-ed exit', async () => {
    const shutdown = jest.fn().mockResolvedValue(undefined);
    jest.mock('@opentelemetry/sdk-node', () => ({
      NodeSDK: jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        shutdown,
      })),
    }));
    jest.mock('@langfuse/otel', () => ({ LangfuseSpanProcessor: jest.fn() }));

    const logSpy = spyOnLogger('log');
    const onSpy = jest.spyOn(process, 'on');
    const unref = jest.fn();
    const setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockReturnValue({ unref } as unknown as NodeJS.Timeout);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./instrument');

    const sigtermCall = onSpy.mock.calls.find(([event]) => event === 'SIGTERM');
    const sigintCall = onSpy.mock.calls.find(([event]) => event === 'SIGINT');
    expect(sigtermCall).toBeDefined();
    expect(sigintCall).toBeDefined();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('LangFuse tracing enabled'),
      'Telemetry',
    );

    const handler = sigtermCall?.[1] as () => void;
    handler();
    await Promise.resolve();
    await Promise.resolve();

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10_000);
    expect(unref).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();

    const scheduledExit = setTimeoutSpy.mock.calls[0][0];
    scheduledExit();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('warns loudly and registers no signal handlers when Langfuse keys are absent', () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;

    const warnSpy = spyOnLogger('warn');
    const onSpy = jest.spyOn(process, 'on');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./instrument');

    expect(onSpy.mock.calls.find(([event]) => event === 'SIGTERM')).toBeUndefined();
    expect(onSpy.mock.calls.find(([event]) => event === 'SIGINT')).toBeUndefined();
    // Silence here is what let #339 go unnoticed for a month.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('LangFuse tracing DISABLED'),
      'Telemetry',
    );
  });
});
