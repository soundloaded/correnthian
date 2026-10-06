import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { listQuotesSchema, quoteStateSchema, type ListQuotesDto } from './dto/list-quotes.dto.js';
import { SwapsService } from './swaps.service.js';

const quoteSchema = z.object({
  fromAssetId: z.string().min(1),
  toAssetId: z.string().min(1),
  fromAmountRaw: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
  notionalUsd: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  slippageBps: z.number().int().min(1).max(5000).optional(),
});

const listSchema = z.object({
  state: quoteStateSchema.optional(),
});

@ApiTags('swaps')
@Controller('swaps')
export class SwapsController {
  constructor(@Inject(SwapsService) private readonly swaps: SwapsService) {}

  @Post('quotes')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a quote. Never executes — the user signs in their own wallet.' })
  quote(@CurrentUser() user: AuthenticatedUser, @Body(zodPipe(quoteSchema)) dto: z.infer<typeof quoteSchema>) {
    return this.swaps.createQuote({ userId: user.id, ...dto });
  }

  @Get('quotes/mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quotes belonging to the current account' })
  mine(@CurrentUser() user: AuthenticatedUser, @Query(zodPipe(listSchema)) q: z.infer<typeof listSchema>) {
    return this.swaps.list(user.id, q.state);
  }

  @Get('quotes/stats')
  @Roles('support')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quote counters' })
  stats() {
    return this.swaps.stats();
  }

  @Get('quotes')
  @Roles('support')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Every quote, for the operator console' })
  listAll(@Query(zodPipe(listQuotesSchema)) query: ListQuotesDto) {
    return this.swaps.listAll(query);
  }

  @Get('quotes/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quote detail' })
  findOne(@Param('id') id: string) {
    return this.swaps.findById(id);
  }
}
