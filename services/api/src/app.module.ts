import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { AssetsController } from './assets/assets.controller.js';
import { AssetsService } from './assets/assets.service.js';

@Module({
  imports: [],
  controllers: [HealthController, AssetsController],
  providers: [AssetsService],
})
export class AppModule {}
