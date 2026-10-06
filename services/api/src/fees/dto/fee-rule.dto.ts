import { z } from 'zod';
import { FEE_ASSET_CATEGORIES, FEE_BASES, FEE_KINDS, FEE_OPERATIONS } from '../fee-rule.js';

/**
 * Fee-rule wire shapes.
 *
 * The rate and the amount are validated here as strictly as the money module
 * validates them, and for the same reason: a rule is authored once and then
 * applied to every quote until someone changes it, so a bad one is not a bad
 * request — it is a bad price, repeated.
 */

export const feeOperationSchema = z.enum(FEE_OPERATIONS);
export const feeKindSchema = z.enum(FEE_KINDS);
export const feeBasisSchema = z.enum(FEE_BASES);
export const feeAssetCategorySchema = z.enum(FEE_ASSET_CATEGORIES);

/**
 * An exact USD amount. A string, never a number — see `money.ts`.
 *
 * Bounded in length as well as in shape. `Decimal(36, 8)` holds 28 digits
 * before the point; a longer amount is refused here so it is a 400 naming the
 * field rather than a Prisma error mapped to a 500.
 */
const usdSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be an exact decimal USD amount, as a string')
  .refine((v) => v.replace('.', '').replace(/^0+/, '').length <= 36, {
    message: 'Amount is larger than an exact USD amount can store',
  });

const countrySchema = z.string().length(2, 'Must be an ISO-3166 alpha-2 country code');

/**
 * The fields an operator authors.
 *
 * Every selector is optional and `null`-able, and the two are deliberately
 * different on this route:
 *
 *   - omitted  — leave the stored value alone (a patch), or default to
 *                unrestricted (a create)
 *   - `null`   — clear the restriction, so the rule applies more widely
 *
 * Collapsing them would mean an operator could widen a rule to every
 * jurisdiction but never narrow it back, because "no country" and "did not
 * mention country" would look the same. This is the same distinction
 * `IssuersService.recordLicences` pins with its omitted-versus-empty-array
 * tests.
 */
const feeRuleFields = {
  operation: feeOperationSchema,
  kind: feeKindSchema,
  basis: feeBasisSchema,
  label: z.string().min(1).max(80),

  rateBps: z.number().int().min(0).max(1_000_000).nullish(),
  fixedUsd: usdSchema.nullish(),

  assetId: z.string().min(1).max(200).nullish(),
  assetCategory: feeAssetCategorySchema.nullish(),
  providerSlug: z.string().min(1).max(80).nullish(),
  country: countrySchema.nullish(),
  region: z.string().min(1).max(20).nullish(),

  minNotionalUsd: usdSchema.nullish(),
  maxNotionalUsd: usdSchema.nullish(),

  priority: z.number().int().min(-1000).max(1000).default(0),

  effectiveFrom: z.coerce.date().nullish(),
  effectiveUntil: z.coerce.date().nullish(),

  active: z.boolean().default(true),
} satisfies z.ZodRawShape;

export const createFeeRuleSchema = z
  .object({
    ...feeRuleFields,

    /**
     * §55's reason. Required by `@RequireAuditReason` on the route, and
     * declared here so it survives validation rather than being stripped —
     * a guard that reads `req.body.reason` and a pipe that removed it would
     * be a guard that never fires.
     */
    reason: z.string().min(8).max(500).optional(),
  })
  .superRefine(validateBasisConsistency);

/** The same shape, every field optional. `null` clears, omission leaves. */
export const updateFeeRuleSchema = z
  .object(feeRuleFields)
  .partial()
  .extend({ reason: z.string().min(8).max(500).optional() })
  .superRefine((value, ctx) => {
    validateBasisConsistency(value, ctx);
    // A patch that changes nothing is almost always a mistake in a client, and
    // it would write an audit line that shows no change.
    if (Object.keys(value).filter((k) => k !== 'reason').length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['(root)'],
        message: 'A fee-rule update must change at least one field',
      });
    }
  });

/**
 * A rule states either a rate or an amount, never both, never neither.
 *
 * Enforced at the edge rather than only in the resolver, because the resolver
 * sees one rule at a time and reports a malformed row as `unknown` — which is
 * honest but late. An operator typing a rate into a fixed rule should be told
 * at the moment they type it.
 */
function validateBasisConsistency(
  value: {
    basis?: string;
    rateBps?: number | null;
    fixedUsd?: string | null;
    minNotionalUsd?: string | null;
    maxNotionalUsd?: string | null;
    effectiveFrom?: Date | null;
    effectiveUntil?: Date | null;
  },
  ctx: z.RefinementCtx,
): void {
  if (value.basis === 'fixed') {
    if (value.fixedUsd === undefined || value.fixedUsd === null) {
      ctx.addIssue({ code: 'custom', path: ['fixedUsd'], message: 'A fixed fee needs an amount' });
    }
    if (value.rateBps !== undefined && value.rateBps !== null) {
      ctx.addIssue({ code: 'custom', path: ['rateBps'], message: 'A fixed fee must not carry a rate' });
    }
  } else if (value.basis !== undefined) {
    if (value.rateBps === undefined || value.rateBps === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['rateBps'],
        message: `A ${value.basis} fee needs a rate in basis points`,
      });
    }
    if (value.fixedUsd !== undefined && value.fixedUsd !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['fixedUsd'],
        message: `A ${value.basis} fee must not carry a fixed amount`,
      });
    }
  }

  if (
    value.minNotionalUsd &&
    value.maxNotionalUsd &&
    compareDecimals(value.minNotionalUsd, value.maxNotionalUsd) > 0
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['minNotionalUsd'],
      message: 'The lower bound is above the upper bound, so no notional could ever match',
    });
  }

  if (value.effectiveFrom && value.effectiveUntil && value.effectiveFrom >= value.effectiveUntil) {
    ctx.addIssue({
      code: 'custom',
      path: ['effectiveFrom'],
      message: 'The rule would end before it begins, so it would never apply',
    });
  }
}

/**
 * Compare two plain decimal strings without ever converting them to a float.
 *
 * The same discipline as `money.ts`, and for the same reason: `100.10` and
 * `100.1` compare equal here, and `0.1 + 0.2` never enters into it.
 */
function compareDecimals(a: string, b: string): number {
  const [ai, af = ''] = a.split('.');
  const [bi, bf = ''] = b.split('.');
  const width = Math.max(af.length, bf.length);
  const left = BigInt((ai || '0') + af.padEnd(width, '0'));
  const right = BigInt((bi || '0') + bf.padEnd(width, '0'));
  return left === right ? 0 : left > right ? 1 : -1;
}

export type CreateFeeRuleDto = z.infer<typeof createFeeRuleSchema>;
export type UpdateFeeRuleDto = z.infer<typeof updateFeeRuleSchema>;

export const listFeeRulesSchema = z.object({
  operation: feeOperationSchema.optional(),
  kind: feeKindSchema.optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type ListFeeRulesDto = z.infer<typeof listFeeRulesSchema>;

/**
 * A fee preview. The same inputs `SwapsService.createQuote` passes, so a user
 * can see the itemisation without creating a quote, and an operator can see
 * what a rule change would do before saving it.
 */
export const previewFeesSchema = z.object({
  operation: feeOperationSchema,
  assetId: z.string().min(1).max(200),
  providerSlug: z.string().min(1).max(80).optional(),
  notionalUsd: usdSchema.optional(),
  country: countrySchema.optional(),
  region: z.string().min(1).max(20).optional(),
});

export type PreviewFeesDto = z.infer<typeof previewFeesSchema>;
