import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Public } from '../common/decorators/public.decorator.js';
import { Idempotent } from '../common/idempotency/idempotency.decorator.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { OnRampService } from './onramp.service.js';

const checkSchema = z.object({
  country: z.string().length(2).toUpperCase().optional(),
  region: z.string().max(64).optional(),
  direction: z.enum(['buy', 'sell']).default('buy'),
});

const quoteSchema = z.object({
  assetId: z.string().min(1),
  amountUsd: z.coerce.number().positive(),
  country: z.string().length(2).toUpperCase().optional(),
  region: z.string().max(64).optional(),
});

@ApiTags('onramp')
@Controller('onramp')
export class OnRampController {
  constructor(@Inject(OnRampService) private readonly onramp: OnRampService) {}

  @Public()
  @Get('availability')
  @ApiOperation({ summary: 'Whether fiat conversion is available here, and why not if it is not' })
  check(@Query(zodPipe(checkSchema)) q: z.infer<typeof checkSchema>) {
    return this.onramp.unavailability(q.direction, q.country ?? null, q.region ?? null);
  }

  @Post('quote')
  @ApiBearerAuth()
  @Idempotent()
  @ApiOperation({ summary: 'Quote a fiat conversion. Refuses rather than fabricating a rate.' })
  quote(@Body(zodPipe(quoteSchema)) q: z.infer<typeof quoteSchema>) {
    return this.onramp.quote('buy', {
      assetId: q.assetId,
      amountUsd: q.amountUsd,
      country: q.country ?? null,
      region: q.region ?? null,
    });
  }
}
