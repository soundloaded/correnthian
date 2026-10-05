import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AssetsModule } from './assets/assets.module.js';
import { AuditModule } from './audit/audit.module.js';
import { ChainsModule } from './chains/chains.module.js';
import { ComplianceModule } from './compliance/compliance.module.js';
import { MetalsModule } from './metals/metals.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OnRampModule } from './onramp/onramp.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CoreModule } from './common/core.module.js';
import { AppConfigModule } from './config/config.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProvidersModule } from './providers/providers.module.js';
import { RedisModule } from './redis/redis.module.js';
import { SwapsModule } from './swaps/swaps.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    AppConfigModule,
    // Pino reads LOG_LEVEL directly. Injecting a module here is not
    // possible — AppConfigModule is a module, not a provider.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['LOG_LEVEL'] ?? 'info',
        // Redaction at the transport layer is a second line of defence;
        // @correnthian/security is still the primary control.
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password'],
          censor: '[REDACTED]',
        },
      },
    }),
    PrismaModule,
    RedisModule,
    CoreModule,
    HealthModule,
    AuthModule,
    UsersModule,
    DevicesModule,
    AssetsModule,
    AuditModule,
    ChainsModule,
    ComplianceModule,
    ProvidersModule,
    SwapsModule,
    MetalsModule,
    NotificationsModule,
    OnRampModule,
  ],
})
export class AppModule {}
