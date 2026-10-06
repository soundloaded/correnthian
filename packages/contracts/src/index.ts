import type { z } from 'zod';
import { CONTRACT_REGISTRY } from './schemas.js';

export * from './schemas.js';

/**
 * Infer a client type from a contract.
 *
 * The point of this package is that clients never hand-write a response type.
 * `type Assets = Contract<'GET /assets'>` follows the API automatically; when
 * the API changes shape, this type changes with it and the client's usage
 * stops compiling — which is the failure that cost three separate incidents
 * where the admin's hand-written types drifted from the API silently.
 */
export type Contract<Path extends keyof typeof CONTRACT_REGISTRY> =
  z.infer<(typeof CONTRACT_REGISTRY)[Path]>;

export { CONTRACT_REGISTRY };
