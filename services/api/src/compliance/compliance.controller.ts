import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Public } from '../common/decorators/public.decorator.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { JurisdictionService } from './jurisdiction.service.js';

const checkSchema = z.object({
  country: z.string().length(2).toUpperCase(),
  region: z.string().max(64).optional(),
});

@ApiTags('compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(@Inject(JurisdictionService) private readonly jurisdiction: JurisdictionService) {}

  @Public()
  @Get('eligibility')
  @ApiOperation({ summary: 'Feature eligibility for a location. Unmatched locations are denied.' })
  check(@Query(zodPipe(checkSchema)) q: z.infer<typeof checkSchema>) {
    return this.jurisdiction.evaluate(q.country, q.region ?? null);
  }
}
