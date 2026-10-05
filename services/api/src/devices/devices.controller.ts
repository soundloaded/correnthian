import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { DevicesService } from './devices.service.js';
import { registerDeviceSchema, type RegisterDeviceDto } from './dto/register-device.dto.js';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(@Inject(DevicesService) private readonly devices: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'List trusted devices' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.devices.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Register a device' })
  register(@CurrentUser() user: AuthenticatedUser, @Body(zodPipe(registerDeviceSchema)) dto: RegisterDeviceDto) {
    return this.devices.register(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a device' })
  async revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.devices.revoke(id, user.id);
  }
}
