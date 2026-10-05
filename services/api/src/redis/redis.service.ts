import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import { ConfigService } from '../config/config.service.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: RedisClientType;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.client = createClient({ url: this.config.redis.url });
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) await this.client.quit();
  }

  get raw(): RedisClientType {
    if (!this.client?.isReady) throw new Error('Redis is not connected');
    return this.client;
  }

  async isHealthy(): Promise<boolean> {
    try {
      return (await this.raw.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
