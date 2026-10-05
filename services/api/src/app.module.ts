import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AssetsModule } from './assets/assets.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CoreModule } from './common/core.module.js';
import { AppConfigModule } from './config/config.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({ inject: [AppConfigModule], useFactory: () => ({}) }),
    PrismaModule,
    RedisModule,
    CoreModule,
    HealthModule,
    AuthModule,
    UsersModule,
    DevicesModule,
    AssetsModule,
  ],
})
export class AppModule {}
