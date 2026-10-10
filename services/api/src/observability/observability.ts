import * as Sentry from '@sentry/node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

export interface ObservabilityInput {
  sentryDsn?: string;
  otelEndpoint?: string;
}

export interface ObservabilityState {
  sentry: boolean;
  tracing: boolean;
  stop: () => Promise<void>;
}

interface ObservabilityDeps {
  sentryInit: (options: { dsn: string }) => void;
  buildTracing: (endpoint: string) => { shutdown: () => Promise<void> };
}

const realDeps: ObservabilityDeps = {
  // Errors only: tracing belongs to OpenTelemetry, and running both
  // tracers would emit every span twice to two backends. Sentry's default
  // without tracesSampleRate is errors, stated here so the default is a
  // decision rather than an accident.
  sentryInit: (options) => Sentry.init({ dsn: options.dsn }),
  buildTracing: (endpoint) => {
    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
        exportIntervalMillis: 60_000,
      }),
      instrumentations: [new HttpInstrumentation()],
    });
    sdk.start();
    return { shutdown: () => sdk.shutdown() };
  },
};

/**
 * Start error reporting and tracing from configuration — BE-105.
 *
 * Called once in main.ts before the app boots, so a crash during startup
 * itself is reported rather than lost. Each sink starts only from its own
 * variable; unset means off, never a client pointed at nowhere. A tracing
 * build that throws leaves tracing off and boot continuing — observability
 * is never load-bearing, and refusing traffic over a collector outage
 * would invert its purpose.
 *
 * What this deliberately does not do: Sentry performance tracing (OTel
 * owns spans), log shipping (pino already structures logs; where they go
 * is a deployment concern, not a code one), or sampling policy (defaults
 * until traffic says otherwise).
 */
export function startObservability(
  input: ObservabilityInput,
  deps: ObservabilityDeps = realDeps,
): ObservabilityState {
  let sentry = false;
  let tracing: { shutdown: () => Promise<void> } | null = null;

  if (input.sentryDsn) {
    deps.sentryInit({ dsn: input.sentryDsn });
    sentry = true;
  }

  if (input.otelEndpoint) {
    try {
      tracing = deps.buildTracing(input.otelEndpoint);
    } catch {
      tracing = null;
    }
  }

  return {
    sentry,
    tracing: tracing !== null,
    stop: async () => {
      if (tracing) await tracing.shutdown();
    },
  };
}
