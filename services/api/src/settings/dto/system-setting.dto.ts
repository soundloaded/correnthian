import { z } from 'zod';

/**
 * System-setting wire shapes.
 *
 * The value is not typed here. It cannot be: the type belongs to the key, and
 * the key is declared in `settings/registry.ts`. The service validates the
 * value against that key's schema, so a value that is a valid number for one
 * setting and nonsense for another is refused by the setting that owns it.
 *
 * What this schema does check is the *shape* of a value: a setting holds a
 * scalar, never an object or an array. A JSON blob in a settings table is a
 * settings table nobody can reason about.
 */
const settingValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const setSettingSchema = z.object({
  value: settingValueSchema,
  /**
   * §55's reason. Declared here so it survives validation rather than being
   * stripped — a guard reading `req.body.reason` and a pipe that removed it
   * would be a guard that never fires. The floor matches the guard's.
   */
  reason: z.string().min(8).max(500).optional(),
});

export type SetSettingDto = z.infer<typeof setSettingSchema>;
