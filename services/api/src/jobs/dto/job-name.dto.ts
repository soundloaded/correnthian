import { z } from 'zod';

/**
 * A job name on the wire.
 *
 * Constrained to the character set a job name is actually written in, rather
 * than matched against the registry, because a name that is not in the
 * registry is a 404 and a name containing a slash is not a route parameter at
 * all — it would be swallowed by the router and produce a confusing 404 about
 * a different path.
 */
export const jobNameSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, 'A job name is lower-case words separated by dots, dashes or underscores');

export type JobNameDto = z.infer<typeof jobNameSchema>;
