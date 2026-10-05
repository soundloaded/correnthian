import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { PricingService } from './pricing.service.js';

const recordSchema = z.object({
  assetId: z.string().min(1),
  priceUsd: z.coerce.number().positive(),
  source: z.string().min(1).max(80),
});

const historySchema = z.object({ limit: z.coerce.number().int().min(1).max(1000).default(100) });

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(@Inject(PricingService) private readonly pricing: PricingService) {}

  @Get('assets/:assetId')
  @ApiOperation({ summary: 'Latest price with staleness. Reference and executable are distinct.' })
  quote(@Param('assetId') assetId: string) {
    return this.pricing.quote(assetId);
  }

  @Get('assets/:assetId/history')
  @ApiOperation({ summary: 'Recent price history' })
  history(@Param('assetId') assetId: string, @Query(zodPipe(historySchema)) q: z.infer<typeof historySchema>) {
    return this.pricing.history(assetId, q.limit);
  }

  @Post('record')
  @Roles('support')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a price from a named source' })
  record(@Body(zodPipe(recordSchema)) dto: z.infer<typeof recordSchema>) {
    return this.pricing.record(dto.assetId, dto.priceUsd, dto.source);
  }
}
