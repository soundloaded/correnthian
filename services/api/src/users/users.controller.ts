import { Body, Controller, Get, Inject, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { listUsersSchema, type ListUsersDto } from './dto/list-users.dto.js';
import { UsersService } from './users.service.js';

const setRoleSchema = z.object({
  role: z.enum(['user', 'support', 'compliance', 'admin', 'owner']),
});

const setStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'closed']),
});

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@Roles('support')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List accounts' })
  list(@Query(zodPipe(listUsersSchema)) query: ListUsersDto) {
    return this.users.list(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Account counters for the dashboard' })
  stats() {
    return this.users.stats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Account detail with wallets and devices' })
  findOne(@Param('id') id: string) {
    return this.users.findById(id);
  }

  @Patch(':id/role')
  @Roles('admin')
  @ApiOperation({ summary: 'Change an account role' })
  setRole(@Param('id') id: string, @Body(zodPipe(setRoleSchema)) dto: z.infer<typeof setRoleSchema>) {
    return this.users.setRole(id, dto.role);
  }

  @Patch(':id/status')
  @Roles('admin')
  @ApiOperation({ summary: 'Change an account status' })
  setStatus(@Param('id') id: string, @Body(zodPipe(setStatusSchema)) dto: z.infer<typeof setStatusSchema>) {
    return this.users.setStatus(id, dto.status);
  }
}
