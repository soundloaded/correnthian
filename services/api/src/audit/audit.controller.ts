import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { AuditService } from './audit.service.js';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().max(80).optional(),
});

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
@Roles('compliance')
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Audit trail' })
  list(@Query(zodPipe(querySchema)) query: z.infer<typeof querySchema>) {
    return this.audit.list(query.limit, query.action);
  }

  @Get('actor/:actorId')
  @ApiOperation({ summary: 'Everything one actor did' })
  forActor(@Param('actorId') actorId: string) {
    return this.audit.forActor(actorId);
  }
}
