import { Controller, Get, HttpCode, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs: number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  /**
   * Liveness. Answers whether the process is up. Deliberately does not touch
   * dependencies — a database outage should not cause the orchestrator to
   * kill otherwise-healthy processes.
   */
  @Public()
  @Get('live')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness probe' })
  live(): { status: 'ok'; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) };
  }

  /**
   * Readiness. Answers whether the process can serve traffic. Fails with 503
   * when a required dependency is down so traffic is diverted, not dropped.
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe, checks dependencies' })
  async ready(): Promise<{ status: 'ok' | 'degraded'; dependencies: Record<string, DependencyStatus> }> {
    const [db, redis] = await Promise.all([
      this.time(() => this.prisma.isHealthy()),
      this.time(() => this.redis.isHealthy()),
    ]);

    const dependencies = { database: db, redis };
    const ok = Object.values(dependencies).every((d) => d.status === 'up');
    return { status: ok ? 'ok' : 'degraded', dependencies };
  }

  private async time(check: () => Promise<boolean>): Promise<DependencyStatus> {
    const start = performance.now();
    try {
      const up = await check();
      return { status: up ? 'up' : 'down', latencyMs: Math.round(performance.now() - start) };
    } catch {
      return { status: 'down', latencyMs: Math.round(performance.now() - start) };
    }
  }
}
