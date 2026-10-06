import { Module } from '@nestjs/common';
import { IdempotencyStore } from './idempotency.store.js';

/**
 * The store is a global provider; the interceptor is registered as a global
 * `APP_INTERCEPTOR` from `CoreModule` so that no controller can be reached
 * without it — but it only acts on routes carrying `@Idempotent()`, so routes
 * that are not financial keep paying nothing.
 */
@Module({
  providers: [IdempotencyStore],
  exports: [IdempotencyStore],
})
export class IdempotencyModule {}