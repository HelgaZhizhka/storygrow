describe('instrument (SIGTERM/SIGINT shutdown)', () => {
  const ORIGINAL_ENV = process.env;

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

  it('does not register any signal handlers when Langfuse keys are absent', () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;

    const onSpy = jest.spyOn(process, 'on');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./instrument');

    expect(onSpy.mock.calls.find(([event]) => event === 'SIGTERM')).toBeUndefined();
    expect(onSpy.mock.calls.find(([event]) => event === 'SIGINT')).toBeUndefined();
  });
});
