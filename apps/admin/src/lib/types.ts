import type { Contract } from '@correnthian/contracts';

/**
 * API response types.
 *
 * These are inferred from the wire-format contracts in `@correnthian/contracts`,
 * not hand-written. That distinction is the whole point: three incidents in this
 * repo came from these declarations drifting from what the API actually returns
 * — a page 500ing on a field nested one level deeper, and a destructive button
 * rendering with an inverted label because the API never sent `enabled`.
 *
 * The API has a contract test that parses its real responses through the same
 * schemas. If either side drifts, that test fails instead of a page.
 */

export type AssetSummary = Contract<'GET /assets'>[number];
export type AssetStats = Contract<'GET /assets/stats'>;
export type UserSummary = Contract<'GET /users'>['items'][number];
export type UserListResponse = Contract<'GET /users'>;
export type UserStats = Contract<'GET /users/stats'>;
export type UserDetail = Contract<'GET /users/:id'>;
export type DeviceRow = Contract<'GET /devices/all'>['items'][number];
export type DeviceListResponse = Contract<'GET /devices/all'>;
export type DeviceStats = Contract<'GET /devices/stats'>;
export type Issuer = Contract<'GET /issuers'>[number];
export type Chain = Contract<'GET /chains'>[number];
export type Provider = Contract<'GET /providers'>[number];

export type KycStatus = UserSummary['kycStatus'];
export type UserRole = UserSummary['role'];

/** Not yet in the contract registry — an endpoint the console does not consume. */
export interface AuditRow {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  outcome: 'success' | 'failure' | 'denied';
  ipAddress: string | null;
  createdAt: string;
}

export interface QuoteStats {
  total: number;
  byState: Record<string, number>;
  byRail: Record<string, number>;
}
