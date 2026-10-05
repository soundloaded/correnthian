import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service.js';

/**
 * Global so every module receives the same validated configuration instance.
 * Validation happens once, at startup, and a bad value stops the process
 * rather than surfacing as a confusing failure inside a request.
 */
@Global()
@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class AppConfigModule {}
