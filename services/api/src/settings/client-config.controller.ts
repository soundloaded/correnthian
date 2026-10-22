import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { ChainsService } from '../chains/chains.service.js';
import { CURRENT_API_VERSION } from '../versioning/api-versions.js';
import { SystemSettingsService } from './system-settings.service.js';

/**
 * The client configuration — the contract web, mobile and marketing read.
 *
 * It exists because a console that changes something is worth nothing if
 * nothing downstream can see it. Chain enablement and maintenance mode are
 * platform-wide facts a client needs before it can offer a screen, and this
 * route is where they are published.
 *
 * **Public, and deliberately small.** Everything here is disclosed to anyone
 * who asks, so it carries only what a client cannot work without: the API
 * version, whether the platform is in maintenance and why, and the chains
 * that are enabled. No counts, no RPC endpoints, no settings that are not
 * marked `clientVisible` in the registry.
 *
 * Feature flags are *not* here. A flag's `rollout` only means something
 * against a subject, and a subject cannot be verified on a public route —
 * `SessionGuard` does not resolve a session for `@Public()` calls, and a
 * caller-supplied subject would let anyone pick their own bucket. Publishing
 * them here would be publishing a half-implemented contract.
 */
@ApiTags('config')
@Controller('config')
export class ClientConfigController {
  constructor(
    @Inject(SystemSettingsService) private readonly settings: SystemSettingsService,
    @Inject(ChainsService) private readonly chains: ChainsService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'What a client needs to know before it offers anything',
    description:
      'Public by design: an unauthenticated client must be able to learn that the platform ' +
      'is in maintenance, and why. Carries the API version, the maintenance state and message, ' +
      'and the enabled chains — and nothing else.',
  })
  async config() {
    const [active, message, chains] = await Promise.all([
      this.settings.get('platform.maintenance-mode'),
      this.settings.get('platform.maintenance-message'),
      this.chains.clientList(),
    ]);

    return {
      version: CURRENT_API_VERSION,
      maintenance: {
        active,
        message: message.trim() === '' ? null : message,
      },
      chains,
    };
  }
}
