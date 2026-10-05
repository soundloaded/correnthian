import { Injectable } from '@nestjs/common';
import { describeBacking } from '@correnthian/assets';
import type { Asset } from '@correnthian/types';
import { SEED_ASSETS } from './seed-registry.js';

export interface ListedAsset {
  asset: Asset;
  /** What the user is actually told they hold. Never omitted. */
  disclosure: string;
}

@Injectable()
export class AssetsService {
  list(): ListedAsset[] {
    return SEED_ASSETS.map((asset) => ({
      asset,
      disclosure: describeBacking(asset) ?? 'Backing information unavailable.',
    }));
  }
}
