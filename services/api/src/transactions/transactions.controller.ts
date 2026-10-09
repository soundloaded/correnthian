import {
  Body, Controller, Get, Inject, Param, Post, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  broadcastSchema, createTransactionSchema, observationSchema, transitionSchema,
  type BroadcastDto, type CreateTransactionDto, type ObservationDto, type TransitionDto,
} from './dto/create-transaction.dto.js';
import {
  listMyTransactionsSchema, listTransactionsSchema, type ListTransactionsDto,
} from './dto/list-transactions.dto.js';
import type { TransactionActor } from './transactions.service.js';
import { TransactionsService } from './transactions.service.js';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(TransactionsService) private readonly transactions: TransactionsService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Record an intended movement',
    description:
      'Creates the record only. The account holder signs in their own wallet; this API ' +
      'has no key and performs no signature. See docs/architecture/key-boundary.md.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(createTransactionSchema)) dto: CreateTransactionDto,
  ) {
    return this.transactions.create(dto, user.id);
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: "This account's own transactions" })
  mine(
    @CurrentUser() user: AuthenticatedUser,
    @Query(zodPipe(listMyTransactionsSchema)) query: { state?: never; direction?: never; limit: number },
  ) {
    return this.transactions.findForUser(user.id, query);
  }

  @Get('stats')
  @Roles('support')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Transaction counters' })
  stats() {
    return this.transactions.stats();
  }

  /**
   * Declared before `:id`, and `listAll` before `findOne`, so the literal
   * segments cannot be swallowed by the parameter route.
   */
  @Get()
  @Roles('support')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Every transaction, for the operator console' })
  listAll(@Query(zodPipe(listTransactionsSchema)) query: ListTransactionsDto) {
    return this.transactions.listAll(query);
  }

  @Post(':id/build')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Assemble the unsigned transaction for an intent',
    description:
      'Returns the payload the account holder\'s device signs, plus the fee it was shown. ' +
      'The API has no key and performs no signature: it assembles, the device signs. ' +
      'The intent stays in `created` — assembling is not signing.',
  })
  assemble(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.transactions.assemble(id, user.id);
  }

  @Post(':id/broadcast')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Relay a payload the device signed',
    description:
      'Decodes the payload, checks its signer, chain and destination against the intent this ' +
      'API assembled, and only then submits it. The payload arrives already signed; nothing ' +
      'here holds or reconstructs a key.',
  })
  broadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(zodPipe(broadcastSchema)) dto: BroadcastDto,
  ) {
    return this.transactions.relay(id, user.id, dto.signed);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'One transaction' })
  findOne(@Param('id') id: string) {
    return this.transactions.detail(id);
  }

  /**
   * The generic edge.
   *
   * Every transition — including `signed` and `broadcast`, which is all a
   * client ever reports — is authorised inside the service against the
   * lifecycle table, so one route cannot become a way around it.
   */
  @Post(':id/transitions')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Advance the lifecycle',
    description:
      'Reports a state the caller has observed or believes to be true. Permitted edges ' +
      'come from the lifecycle table; a rejected one is refused rather than applied.',
  })
  transition(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Param('id') id: string,
    @Body(zodPipe(transitionSchema)) dto: TransitionDto,
  ) {
    // Routed through the named method so "a broadcast needs a hash" is
    // expressed once, at the place that knows what a broadcast is, rather than
    // as a conditional in a route handler.
    if (dto.to === 'broadcast') {
      return this.transactions.reportBroadcast(id, actorOf(req), dto);
    }
    return this.transactions.transition(id, dto.to, actorOf(req), dto);
  }

  @Post(':id/observations')
  @Roles('support')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Record what a node reports',
    description:
      'The observation path. Confirmation depth is a fact read off a chain, not a claim ' +
      'by a person, so it is recorded here rather than through the transition route.',
  })
  observe(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Param('id') id: string,
    @Body(zodPipe(observationSchema)) dto: ObservationDto,
  ) {
    return this.transactions.observe(id, actorOf(req), dto);
  }
}

/**
 * Guards have already refused an unauthenticated request by the time a
 * handler runs, so the fallback is unreachable rather than meaningful.
 */
function actorOf(req: Request & { user?: AuthenticatedUser }): TransactionActor {
  return { id: req.user?.id ?? 'unknown', role: req.user?.role ?? 'user' };
}