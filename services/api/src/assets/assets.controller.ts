import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { AssetsService } from './assets.service.js';
import { createAssetSchema, listAssetsSchema, type CreateAssetDto, type ListAssetsDto } from './dto/list-assets.dto.js';

const attestationSchema = z.object({
  attestedAt: z.coerce.date(),
  proofUrl: z.string().url().max(500).optional(),
});

const enabledSchema = z.object({ enabled: z.boolean() });

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(@Inject(AssetsService) private readonly assets: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'Asset registry with backing disclosure' })
  list(@Query(zodPipe(listAssetsSchema)) query: ListAssetsDto) {
    return this.assets.list(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Registry health counters' })
  stats() {
    return this.assets.stats();
  }

  @Get(':assetId')
  @ApiOperation({ summary: 'Asset detail with backing disclosure' })
  findOne(@Param('assetId') assetId: string) {
    return this.assets.findByAssetId(assetId);
  }

  @Post()
  @Roles('compliance')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register an asset (identity is derived, never supplied)' })
  create(@Body(zodPipe(createAssetSchema)) dto: CreateAssetDto) {
    return this.assets.create(dto);
  }

  @Patch(':assetId/enabled')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable or disable an asset' })
  setEnabled(@Param('assetId') assetId: string, @Body(zodPipe(enabledSchema)) dto: { enabled: boolean }) {
    return this.assets.setEnabled(assetId, dto.enabled);
  }

  @Patch(':assetId/attestation')
  @Roles('compliance')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a proof-of-reserves attestation' })
  recordAttestation(
    @Param('assetId') assetId: string,
    @Body(zodPipe(attestationSchema)) dto: z.infer<typeof attestationSchema>,
  ) {
    return this.assets.recordAttestation(assetId, dto.attestedAt, dto.proofUrl);
  }
}
