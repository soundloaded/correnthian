import { Module } from '@nestjs/common';
import { IssuersController } from './issuers.controller.js';
import { IssuersService } from './issuers.service.js';
import { VERIFICATION_FETCH, httpVerificationFetch } from './verification-fetch.js';

/**
 * The proof-URL fetch is a port, not a hardcoded call.
 *
 * A verification that cites a proof URL is only a verification if something
 * asks that page — so the check fetches it, and a fetch that cannot be
 * replaced is a fetch the test suite cannot avoid. Suites override the
 * provider; production gets the real HTTPS request.
 */
@Module({
  controllers: [IssuersController],
  providers: [
    IssuersService,
    { provide: VERIFICATION_FETCH, useValue: httpVerificationFetch },
  ],
  exports: [IssuersService, VERIFICATION_FETCH],
})
export class IssuersModule {}
