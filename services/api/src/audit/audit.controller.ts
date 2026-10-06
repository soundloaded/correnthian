import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { Roles } from '../common/guards/roles.guard.js';
import { listAuditSchema, type ListAuditDto } from './dto/list-audit.dto.js';
import { AuditService } from './audit.service.js';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
@Roles('compliance')
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Audit trail' })
  list(@Query(zodPipe(listAuditSchema)) query: ListAuditDto) {
    return this.audit.list(query);
  }

  @Get('actor/:actorId')
  @ApiOperation({ summary: 'Everything one actor did' })
  forActor(@Param('actorId') actorId: string) {
    return this.audit.forActor(actorId);
  }

  /**
   * Declared last so it cannot shadow the literal `actor/:actorId` segment
   * above. It exists because the list withholds `metadata`: reading one entry's
   * redacted payload is an investigation, not something to put in a table.
   */
  @Get(':id')
  @ApiOperation({ summary: 'One audit entry, including its redacted metadata' })
  findOne(@Param('id') id: string) {
    return this.audit.findById(id);
  }
}