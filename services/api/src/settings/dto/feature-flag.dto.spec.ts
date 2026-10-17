import { describe, expect, it } from 'vitest';
import { createFlagSchema, updateFlagSchema } from './feature-flag.dto.js';

/**
 * Flag DTOs — BE-1505.
 *
 * Keys are namespaced lowercase; rollout is a percentage, not a promise. The
 * empty-patch refusal lives here rather than the service: an update that
 * changes nothing would otherwise write an audit line that shows no change.
 */
describe('feature-flag DTOs', () => {
  const base = { key: 'billing.export', enabled: false, rollout: 10, description: null };

  it('accepts a well-formed create', () => {
    expect(createFlagSchema.safeParse({ ...base, reason: 'launching the export switch slowly' }).success).toBe(true);
  });

  it('refuses keys outside the namespace shape', () => {
    expect(createFlagSchema.safeParse({ ...base, key: 'Billing Export' }).success).toBe(false);
    expect(createFlagSchema.safeParse({ ...base, key: 'x' }).success).toBe(false);
  });

  it('refuses rollouts that are not percentages', () => {
    expect(createFlagSchema.safeParse({ ...base, rollout: 101 }).success).toBe(false);
    expect(createFlagSchema.safeParse({ ...base, rollout: -1 }).success).toBe(false);
  });

  it('refuses an update that changes nothing', () => {
    expect(updateFlagSchema.safeParse({}).success).toBe(false);
    expect(updateFlagSchema.safeParse({ reason: 'words without a change' }).success).toBe(false);
  });

  it('accepts a single-field patch and a cleared description', () => {
    expect(updateFlagSchema.safeParse({ enabled: true }).success).toBe(true);
    expect(updateFlagSchema.safeParse({ description: null }).success).toBe(true);
  });
});
