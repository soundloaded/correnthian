// Must come first: ConfigService validates process.env during module init,
// and `node dist/main.js` has no env loader of its own.
import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createContractDocument } from './versioning/apply-contracts.js';
import helmet from 'helmet';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { ConfigService } from './config/config.service.js';
import { startObservability } from './observability/observability.js';
import { applyApiVersioning } from './versioning/apply-versioning.js';

async function bootstrap(): Promise<void> {
  // `rawBody: true` keeps the untouched request bytes on `req.rawBody`.
  // JSON parsing consumes the stream, and the Persona webhook verifies its
  // HMAC over the raw bytes — without this the signature input is gone and
  // every signature fails, including valid ones. Attaching the buffer costs
  // nothing on routes that never read it.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  const config = app.get(ConfigService);

  // Error reporting and tracing, before anything else that can fail. Each
  // starts only from its own variable; unset means off, and a tracing build
  // that throws leaves tracing off rather than refusing traffic.
  const observability = startObservability({
    sentryDsn: config.value.observability.sentryDsn,
    otelEndpoint: config.value.observability.otelEndpoint,
  });
  if (observability.sentry || observability.tracing) {
    new Logger('Observability').log(
      `sentry=${observability.sentry ? 'on' : 'off'} tracing=${observability.tracing ? 'on' : 'off'}`,
    );
  }

  // Structured logging. Anything reaching a log must already be redacted.
  app.useLogger(app.get(PinoLogger));

  // `/api/v1` on every route, plus version negotiation in front of them.
  // Before `init()`, so the middleware is registered ahead of Nest's router.
  applyApiVersioning(app);

  app.use(
    helmet({
      // The API serves JSON to first-party clients; a restrictive CSP here
      // would only break Swagger UI, which is disabled outside development.
      contentSecurityPolicy: config.isProduction ? undefined : false,
    }),
  );

  app.enableCors({
    origin: config.http.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    // A client is allowed to send this on every request and gets a distinct
    // replayed response back, so a browser must be able to read it. Without
    // this the header is stripped and a retrying client cannot tell a replay
    // from a fresh execution.
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['Idempotency-Replayed', 'X-API-Version', 'Deprecation', 'Sunset', 'Link', 'Warning'],
  });

  if (config.http.trustProxy) app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const swagger = new DocumentBuilder()
    .setTitle('Correnthian API')
    .setDescription(
      'Backend for the Correnthian self-custodial platform. ' +
        'This API holds no user key material and must never be able to move user funds.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  // Response schemas come from `CONTRACT_REGISTRY` — the same object
  // `contracts.spec.ts` parses real responses with — because none of these
  // routes have decorated DTOs for Swagger to read. See `applyContracts`.
  const openapi = new Logger('OpenAPI');
  const { document, applied } = createContractDocument(app, swagger);
  if (applied.unmatched.length > 0) {
    // A contract with no route behind it means the registry and the controllers
    // have diverged. Loud, because it is exactly what this wiring exists to
    // prevent.
    openapi.warn(
      `OpenAPI: ${applied.unmatched.length} contract(s) matched no route: ` +
        applied.unmatched.join(', '),
    );
  }
  openapi.log(
    `OpenAPI: ${applied.applied} response schema(s) from the contract registry, ` +
      `${applied.canonicalised} versioned path(s) added`,
  );
  SwaggerModule.setup('docs', app, document);

  // Close connections before the process exits, so in-flight requests are
  // not severed and pooled connections are drained.
  app.enableShutdownHooks();

  await app.listen(config.http.port, config.http.host);
  Logger.log(`Correnthian API listening on ${config.http.host}:${config.http.port}`, 'Bootstrap');
}

void bootstrap();
