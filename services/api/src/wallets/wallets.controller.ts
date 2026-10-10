import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { WalletsService } from './wallets.service.js';

const registerSchema = z.object({
  address: z.string().min(1).max(128),
  chainId: z.string().min(1).max(32),
  kind: z.enum(['smart', 'seed']),
  label: z.string().max(64).optional(),
  guardians: z.array(z.string().max(128)).max(10).optional(),
});

const balanceSchema = z.object({ balanceRaw: z.string().regex(/^\d+(\.\d+)?$/) });
const guardiansSchema = z.object({ guardians: z.array(z.string().max(128)).max(10) });
const labelSchema = z.object({ label: z.string().max(64) });
const assetParam = z.object({ assetId: z.string().min(1) });

@ApiTags('wallets')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(@Inject(WalletsService) private readonly wallets: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'Registered public addresses' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.wallets.list(user.id);
  }

  @Get('portfolio')
  @ApiOperation({ summary: 'Registered addresses with balances' })
  portfolio(@CurrentUser() user: AuthenticatedUser) {
    return this.wallets.portfolio(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Wallet detail with per-asset balances' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wallets.findById(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Register a public address. No key material is accepted or stored.' })
  register(@CurrentUser() user: AuthenticatedUser, @Body(zodPipe(registerSchema)) dto: z.infer<typeof registerSchema>) {
    return this.wallets.register(user.id, dto);
  }

  @Patch(':id/label')
  @ApiOperation({ summary: 'Relabel a wallet' })
  setLabel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body(zodPipe(labelSchema)) dto: z.infer<typeof labelSchema>) {
    return this.wallets.setLabel(user.id, id, dto.label);
  }

  @Patch(':id/guardians')
  @ApiOperation({ summary: 'Replace the guardian list. Smart wallets only.' })
  setGuardians(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(zodPipe(guardiansSchema)) dto: z.infer<typeof guardiansSchema>,
  ) {
    return this.wallets.setGuardians(user.id, id, dto.guardians);
  }

  @Patch(':id/primary')
  @ApiOperation({ summary: 'Make a wallet primary' })
  setPrimary(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wallets.setPrimary(user.id, id);
  }

  @Post(':id/balances/:assetId')
  @ApiOperation({ summary: 'Record a public-chain balance. Base units, as a decimal string.' })
  setBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Body(zodPipe(z.object({ balanceRaw: z.string().regex(/^\d+(\.\d+)?$/) }))) dto: { balanceRaw: string },
  ) {
    return this.wallets.setBalance(user.id, id, assetId, dto.balanceRaw);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Stop tracking an address. On-chain funds are unaffected.' })
  async deregister(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.wallets.deregister(user.id, id);
  }
}
