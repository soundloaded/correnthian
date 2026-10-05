import { Controller, Get } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { AssetsService, ListedAsset } from './assets.service.js';

/**
 * @Inject() is explicit rather than relying on emitDecoratorMetadata.
 * Nest's CLI uses tsc, which emits decorator metadata; vitest uses esbuild,
 * which does not. Explicit injection behaves identically under both.
 */
@Controller('assets')
export class AssetsController {
  constructor(@Inject(AssetsService) private readonly assetsService: AssetsService) {}

  @Get()
  list(): ListedAsset[] {
    return this.assetsService.list();
  }
}
