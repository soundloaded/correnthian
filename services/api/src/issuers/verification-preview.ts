/**
 * What a verification run measured, for the audit trail and the console.
 *
 * The tier is shown to users as a trust signal, so the trail records what
 * was checked as well as what was decided. This shape is what an operator
 * reads *before* deciding: the checks, plus per-asset freshness, so the
 * page can say which asset is stale rather than only that something is.
 *
 * `verification-checks.ts` owns the pass/fail report the promotion gate
 * reads (`VerificationReport`). This shape extends it with the per-asset
 * breakdown the console renders.
 */
import type { VerificationCheck } from './verification-checks.js';

export interface VerificationPreview {
  readonly passed: boolean;
  readonly checks: VerificationCheck[];
  /** URLs the machine fetched while checking. A digest list, not content. */
  readonly checkedUrls: string[];
  /** Freshness per asset, so the operator can see which asset is stale. */
  readonly assetResults: Array<{ assetId: string; symbol: string; fresh: boolean }>;
}
