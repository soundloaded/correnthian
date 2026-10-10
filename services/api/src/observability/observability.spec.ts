import { describe, expect, it, vi } from 'vitest';
import { startObservability } from './observability.js';

/**
 * Boot-time observability — BE-105.
 *
 * SENTRY_DSN and OTEL_EXPORTER_OTLP_ENDPOINT were read by nothing for the
 * whole project history. Now they initialise Sentry error reporting and
 * OpenTelemetry tracing/metrics — but only when set. An unset endpoint
 * must mean explicitly off, never a half-initialised SDK phoning nowhere,
 * so the first assertions are on the off path, not the on one.
 *
 * Dependencies ride as parameters with SDK defaults, so these tests assert
 * which initialisers ran without importing (or contacting) anything real.
 */
describe('startObservability', () => {
  it('does nothing when nothing is configured', async () => {
    const sentryInit = vi.fn();
    const buildTracing = vi.fn();
    const state = startObservability({}, { sentryInit, buildTracing });

    expect(state).toMatchObject({ sentry: false, tracing: false });
    expect(sentryInit).not.toHaveBeenCalled();
    expect(buildTracing).not.toHaveBeenCalled();
    await expect(state.stop()).resolves.toBeUndefined();
  });

  it('starts error reporting alone when only Sentry is configured', async () => {
    const sentryInit = vi.fn();
    const buildTracing = vi.fn();
    const state = startObservability(
      { sentryDsn: 'https://x@sentry.io/1' },
      { sentryInit, buildTracing },
    );

    expect(state).toMatchObject({ sentry: true, tracing: false });
    expect(sentryInit).toHaveBeenCalledTimes(1);
    expect(sentryInit.mock.calls[0]?.[0]).toMatchObject({ dsn: 'https://x@sentry.io/1' });
    expect(buildTracing).not.toHaveBeenCalled();
    await state.stop();
  });

  it('starts tracing and metrics alone when only OTel is configured', async () => {
    const sentryInit = vi.fn();
    const shutdown = vi.fn(async () => {});
    const buildTracing = vi.fn(() => ({ shutdown }));
    const state = startObservability(
      { otelEndpoint: 'http://collector:4318' },
      { sentryInit, buildTracing },
    );

    expect(state).toMatchObject({ sentry: false, tracing: true });
    expect(sentryInit).not.toHaveBeenCalled();
    expect(buildTracing).toHaveBeenCalledWith('http://collector:4318');
    await state.stop();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it('starts both independently when both are configured', async () => {
    const sentryInit = vi.fn();
    const shutdown = vi.fn(async () => {});
    const buildTracing = vi.fn(() => ({ shutdown }));
    const state = startObservability(
      { sentryDsn: 'https://x@sentry.io/1', otelEndpoint: 'http://collector:4318' },
      { sentryInit, buildTracing },
    );

    expect(state).toMatchObject({ sentry: true, tracing: true });
    await state.stop();
  });

  it('a tracing build failure does not take down boot', async () => {
    // Observability must never be load-bearing: a collector that refuses
    // the SDK at startup is an ops problem, not a reason to refuse traffic.
    const buildTracing = vi.fn(() => {
      throw new Error('connection refused');
    });
    const state = startObservability(
      { otelEndpoint: 'http://collector:4318' },
      { sentryInit: vi.fn(), buildTracing },
    );

    expect(state).toMatchObject({ tracing: false });
    await expect(state.stop()).resolves.toBeUndefined();
  });
});
