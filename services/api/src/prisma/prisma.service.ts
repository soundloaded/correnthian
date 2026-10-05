import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { ConfigService } from '../config/config.service.js';

/**
 * Prisma 7 requires an explicit driver adapter; the connection string alone
 * is no longer enough.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(ConfigService) config: ConfigService) {
    super({
      adapter: new PrismaPg({ connectionString: config.database.url }),
      log: config.isProduction
        ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }]
        : [{ emit: 'event', level: 'query' }, { emit: 'event', level: 'warn' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Liveness of the database, for the readiness probe. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
