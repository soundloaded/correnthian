import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { PortfolioService } from './portfolio.service.js';

@ApiTags('portfolio')
@ApiBearerAuth()
@Controller('portfolio')
export class PortfolioController {
  constructor(@Inject(PortfolioService) private readonly portfolio: PortfolioService) {}

  @Get()
  @ApiOperation({ summary: 'Valued portfolio across every registered address' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.portfolio.forUser(user.id);
  }

  @Get('wallets/:walletId')
  @ApiOperation({ summary: 'Valued portfolio for one address' })
  forWallet(@CurrentUser() user: AuthenticatedUser, @Param('walletId') walletId: string) {
    return this.portfolio.forWallet(user.id, walletId);
  }

  @Get('wallets/:walletId/history')
  @ApiOperation({ summary: 'Snapshot history' })
  history(@CurrentUser() user: AuthenticatedUser, @Param('walletId') walletId: string) {
    return this.portfolio.history(user.id, walletId);
  }

  @Post('wallets/:walletId/snapshot')
  @ApiOperation({ summary: 'Persist a valuation snapshot' })
  capture(@CurrentUser() user: AuthenticatedUser, @Param('walletId') walletId: string) {
    return this.portfolio.capture(user.id, walletId);
  }
}
