import { Body, Controller, Headers, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { redactDeep } from '@correnthian/security';
import { AppError } from '../common/errors.js';
import { Public } from '../common/decorators/public.decorator.js';
import { KycService } from './kyc.service.js';
import { PERSONA_SIGNATURE_HEADER } from './screening/persona-screening.provider.js';
import { SCREENING_PROVIDER, ScreeningProvider } from './screening/screening-provider.js';

/**
 * Persona's way back in — BE-1101 §2.
 *
 * Order is the whole contract here: signature before parse, parse before
 * apply. A controller that parsed first would pass every unit suite (the
 * adapter verifies, the service applies — both tested) while accepting
 * forged events, which is why the order is asserted over HTTP rather than
 * read from the source.
 *
 * Status codes are retry semantics, not just outcomes: Persona retries
 * failures, so 500 is reserved for genuine processing failures
 * (infrastructure down mid-apply). Anything validly signed but
 * inapplicable — duplicate, unbound, stale — is acknowledged with 200 and
 * `applied: false`, because retrying it changes nothing and retrying an
 * attacker's probe is a retry storm of our own making. Unsigned bytes are
 * 401: they are not Persona retrying, they are someone else knocking.
 */
@ApiTags('compliance')
@Controller('compliance/webhooks')
export class PersonaWebhookController {
  constructor(
    @Inject(KycService) private readonly kyc: KycService,
    @Inject(SCREENING_PROVIDER) private readonly screening: ScreeningProvider,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Public()
  @Post('persona')
  @HttpCode(200)
  @ApiOperation({ summary: 'Persona inquiry decision webhook (signed)' })
  async persona(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers(PERSONA_SIGNATURE_HEADER) signature: string | undefined,
    @Body() body: unknown,
  ): Promise<{ received: boolean; applied: boolean; status?: string; reason?: string }> {
    const rawBody = req.rawBody;
    if (!rawBody || !signature || !this.screening.verifyWebhookSignature(rawBody, signature)) {
      // Logged redacted: an unsigned body is attacker-controlled input, and
      // attacker-controlled input does not go into logs unredacted.
      this.audit.record({
        actorId: null,
        action: 'webhook.rejected',
        targetType: 'WebhookEvent',
        outcome: 'failure',
        metadata: { provider: 'persona', reason: 'bad_signature', body: redactDeep(body) },
      }).catch(() => undefined);
      throw AppError.unauthorized('Invalid webhook signature');
    }

    let event;
    try {
      event = this.screening.parseWebhookEvent(body);
    } catch (err) {
      // Valid signature, unrecognised shape: acknowledge, do not retry.
      // Either Persona changed its envelope (correct the parser) or someone
      // replayed a signed-but-foreign event (nothing to apply it to).
      return {
        received: true,
        applied: false,
        reason: err instanceof Error ? err.message : 'unrecognised event',
      };
    }

    return { received: true, ...(await this.kyc.applyWebhookEvent(event)) };
  }
}
