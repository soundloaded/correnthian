import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ValidationError } from '../errors.js';

/**
 * Validate and transform with Zod.
 *
 * The parsed value replaces the raw one, so handlers receive typed data and a
 * handler cannot accidentally read an unvalidated field.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ValidationError(
        result.error.issues.map((i) => ({
          path: i.path.join('.') || '(root)',
          message: i.message,
        })),
      );
    }
    return result.data;
  }
}

export const zodPipe = <T>(schema: ZodType<T>) => new ZodValidationPipe(schema);
