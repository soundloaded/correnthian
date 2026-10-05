import { Body, Controller, Get, Inject, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { ProvidersService } from './providers.service.js';

const querySchema = z.object({
  category: z.enum(['metals', 'onramp', 'offramp', 'rpc', 'pricing', 'kyc', 'sanctions', 'indexer']).optional(),
});

const statusSchema = z.object({
  status: z.enum(['active', 'degraded', 'disabled']),
});

@ApiTags('providers')
@Controller('providers')
export class ProvidersController {
  constructor(@Inject(ProvidersService) private readonly providers: ProvidersService) {}

  @Get()
  @ApiOperation({ summary: 'Provider registry. Never contains credentials.' })
  list(@Query(zodPipe(querySchema)) query: z.infer<typeof querySchema>) {
    return this.providers.list(query.category);
  }

  @Get('health')
  @ApiOperation({ summary: 'Provider health summary' })
  health() {
    return this.providers.healthSummary();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Provider detail' })
  findOne(@Param('slug') slug: string) {
    return this.providers.findBySlug(slug);
  }

  @Patch(':slug/status')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change provider status' })
  setStatus(@Param('slug') slug: string, @Body(zodPipe(statusSchema)) dto: z.infer<typeof statusSchema>) {
    return this.providers.setStatus(slug, dto.status);
  }
}
