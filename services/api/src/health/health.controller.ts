import { Controller, Get, HttpCode, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { SkipRateLimit } from '../common/guards/rate-limit.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs: number;
}

@ApiTags('health')
@SkipRateLimit()
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
   * Readiness. Answers whether the process can serve traffic.
   *
   * **503 when a required dependency is down, not 200 with a flag.** The
   * docstring always promised this and the code never did it, so an
   * orchestrator reading only the status code kept routing to a process that
   * could not serve — a readiness probe that says "fine" during an outage is
   * worse than no probe, because the failure now looks like application load.
   *
   * The status is set through `passthrough` rather than by throwing, because
   * `AllExceptionsFilter` rewrites any exception into the shared error
   * envelope. Throwing would have returned 503 with `dependencies` replaced by
   * `detail`, and every consumer of this endpoint reads `dependencies` to know
   * *which* thing is down. Diverting traffic must not cost the operator the
   * reason.
   *
   * Both dependencies are required: with Redis down the rate limiter fails
   * closed and refuses every request, so the process genuinely cannot serve
   * even though its own code is healthy.
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe, checks dependencies' })
  async ready(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: 'ok' | 'degraded'; dependencies: Record<string, DependencyStatus> }> {
    const [db, redis] = await Promise.all([
      this.time(() => this.prisma.isHealthy()),
      this.time(() => this.redis.isHealthy()),
    ]);

    const dependencies = { database: db, redis };
    const ok = Object.values(dependencies).every((d) => d.status === 'up');
    res.status(ok ? 200 : 503);
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
