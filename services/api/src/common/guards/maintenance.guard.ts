import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../errors.js';
import { SystemSettingsService } from '../../settings/system-settings.service.js';

/**
 * The paths that stay open while the platform is in maintenance.
 *
 * Each one is here because something breaks without it:
 *
 *  - `/api/v1/settings` — the only way back out. A guard that blocks the
 *    switch that turns maintenance off is a permanent outage.
 *  - `/api/v1/auth` — an operator has to be able to sign in to reach the
 *    settings page at all.
 *  - `/api/v1/config` — it carries `maintenance.active` and the message, so
 *    a client can tell the user *why* it is being refused rather than
 *    showing a bare error.
 *  - `/api/v1/meta` — version discovery, which a client needs in order to
 *    know where to retry.
 *  - `/api/v1/compliance/webhooks` — inbound vendor events. Persona retries
 *    with backoff, but a closed platform that drops verification events
 *    would leave people's screening state behind.
 *
 * Everything else under `/api/` is refused with a 503.
 */
const ALLOWED_PREFIXES = [
  '/api/v1/settings',
  '/api/v1/auth',
  '/api/v1/meta',
  '/api/v1/compliance/webhooks',
] as const;

const ALLOWED_EXACT = new Set(['/api/v1/config']);

/** Whether a path is one of the paths that stay open. */
export function isAllowedDuringMaintenance(path: string): boolean {
  if (ALLOWED_EXACT.has(path)) return true;
  return ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Maintenance mode, enforced.
 *
 * The setting is read from the same store every other setting comes from, so
 * an operator turns maintenance on and off from the console and the change
 * takes effect on the next request — with no restart and no redeploy.
 *
 * Two decisions are worth stating:
 *
 *  - **It fails open.** If the setting cannot be read, the request is
 *    allowed. A configuration read that fails must not become a second
 *    outage, and a refusal nobody can clear is worse than an open platform
 *    during a database incident.
 *  - **It matches `req.url`, not `req.originalUrl`.** The version middleware
 *    rewrites `req.url` to the versioned path and deliberately leaves
 *    `originalUrl` alone, so an `originalUrl` match would let the
 *    transitional unversioned alias walk straight through the guard.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  private readonly logger = new Logger(MaintenanceGuard.name);

  constructor(
    @Inject(SystemSettingsService) private readonly settings: SystemSettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ url: string }>();
    const path = request.url ?? '';

    // Only the versioned API surface is closed. `/health` and `/docs` live
    // outside it, and an orchestrator's probe must keep answering: the
    // process is healthy, and it is the one serving the 503.
    if (!path.startsWith('/api/')) return true;
    if (isAllowedDuringMaintenance(path)) return true;

    let active: boolean;
    try {
      active = await this.settings.get('platform.maintenance-mode');
    } catch (err) {
      this.logger.error(
        'Could not read the maintenance setting; allowing the request. ' +
          'A configuration read that fails must not close the platform.',
      );
      return true;
    }

    if (!active) return true;

    // The message is read only in the window itself, so the hot path stays
    // one primary-key read.
    let notice: string | undefined;
    try {
      const message = await this.settings.get('platform.maintenance-message');
      notice = message.trim() === '' ? undefined : message;
    } catch {
      notice = undefined;
    }

    throw AppError.maintenance(
      'The platform is in maintenance.',
      notice ? { message: notice } : undefined,
    );
  }
}
