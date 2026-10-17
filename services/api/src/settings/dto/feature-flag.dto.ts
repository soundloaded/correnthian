import { z } from 'zod';

/**
 * Feature-flag wire shapes — BE-1505.
 *
 * A flag is a named switch with a rollout percentage. The row has existed in
 * the schema since the init migration with nothing reading or writing it;
 * these schemas are its first edge.
 *
 * Keys are namespaced (`feature.area`): grepping for `billing.` finds every
 * flag in a surface, and a bare `gold` can never collide with a later
 * `gold.exit`.
 */
const keySchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'Must be a lowercase dotted key like billing.export');

const flagFields = {
  enabled: z.boolean(),
  rollout: z.number().int().min(0).max(100),
  description: z.string().max(500).nullable(),
} satisfies z.ZodRawShape;

export const createFlagSchema = z.object({
  key: keySchema,
  ...flagFields,
  /**
   * §55's reason. Declared here so it survives validation rather than being
   * stripped — a guard reading `req.body.reason` and a pipe that removed it
   * would be a guard that never fires.
   */
  reason: z.string().min(8).max(500).optional(),
});

export const updateFlagSchema = z
  .object({ ...flagFields, reason: z.string().min(8).max(500).optional() })
  .partial()
  .superRefine((value, ctx) => {
    // A patch that changes nothing would write an audit line that shows no
    // change. Almost always a client mistake.
    if (Object.keys(value).filter((k) => k !== 'reason').length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['(root)'],
        message: 'A flag update must change at least one field',
      });
    }
  });

export type CreateFlagDto = z.infer<typeof createFlagSchema>;
export type UpdateFlagDto = z.infer<typeof updateFlagSchema>;
