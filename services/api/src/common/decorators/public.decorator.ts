import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'correnthian:isPublic';

/**
 * Opt a route out of session authentication. Everything is authenticated
 * unless explicitly marked — deny by default.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
