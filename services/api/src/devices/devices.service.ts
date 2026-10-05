import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegisterDeviceDto } from './dto/register-device.dto.js';

@Injectable()
export class DevicesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.device.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, platform: true, label: true, trustedAt: true, lastSeenAt: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async register(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.device.create({
      data: {
        userId,
        platform: dto.platform,
        label: dto.label,
        publicKey: dto.publicKey,
        pushToken: dto.pushToken,
      },
      select: { id: true, platform: true, label: true, trustedAt: true, lastSeenAt: true },
    });
  }

  async touch(deviceId: string, userId: string) {
    const { count } = await this.prisma.device.updateMany({
      where: { id: deviceId, userId, revokedAt: null },
      data: { lastSeenAt: new Date() },
    });
    if (count === 0) throw AppError.notFound('Device not found');
  }

  /**
   * Revoking is soft: an audit trail must survive the device being removed.
   */
  async revoke(deviceId: string, userId: string) {
    const { count } = await this.prisma.device.updateMany({
      where: { id: deviceId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw AppError.notFound('Device not found');
  }
}
