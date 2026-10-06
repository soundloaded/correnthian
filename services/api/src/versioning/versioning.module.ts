import { Module } from '@nestjs/common';
import { ApiMetaController } from './api-meta.controller.js';

/**
 * The versioning module itself carries no runtime wiring — the prefix, the
 * middleware and the not-found handler are applied by `applyApiVersioning`,
 * which `main.ts` and the contract suite both call. This module exists only to
 * own the version-discovery controller.
 */
@Module({
  controllers: [ApiMetaController],
})
export class VersioningModule {}