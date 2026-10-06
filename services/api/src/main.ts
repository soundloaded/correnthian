// Must come first: ConfigService validates process.env during module init,
// and `node dist/main.js` has no env loader of its own.
import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { ConfigService } from './config/config.service.js';
import { applyApiVersioning } from './versioning/apply-versioning.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

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
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  // Close connections before the process exits, so in-flight requests are
  // not severed and pooled connections are drained.
  app.enableShutdownHooks();

  await app.listen(config.http.port, config.http.host);
  Logger.log(`Correnthian API listening on ${config.http.host}:${config.http.port}`, 'Bootstrap');
}

void bootstrap();
