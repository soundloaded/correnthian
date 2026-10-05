import { Body, Controller, Get, Inject, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { ChainsService } from './chains.service.js';

const enabledSchema = z.object({ enabled: z.boolean() });

@ApiTags('chains')
@Controller('chains')
export class ChainsController {
  constructor(@Inject(ChainsService) private readonly chains: ChainsService) {}

  @Get()
  @ApiOperation({ summary: 'Configured chains. RPC endpoints are never exposed.' })
  list() {
    return this.chains.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chain detail' })
  findOne(@Param('id') id: string) {
    return this.chains.findById(id);
  }

  @Patch(':id/enabled')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable or disable a chain' })
  setEnabled(@Param('id') id: string, @Body(zodPipe(enabledSchema)) dto: { enabled: boolean }) {
    return this.chains.setEnabled(id, dto.enabled);
  }
}
