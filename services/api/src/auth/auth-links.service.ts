import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppError } from '../common/errors.js';
import { hashSessionToken } from './token-hash.js';
import { AuditService } from '../audit/audit.service.js';
import { ConfigService } from '../config/config.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SessionUser } from './auth.service.js';

/**
 * One-time links for passwordless sign-in and password reset — BE-203.
 *
 * A magic link and a reset link are the same shape: a single-use token,
 * bound to one account, that dies after a short window. Both are bearer
 * credentials for their lifetime, so both live under the same rules:
 * the raw token is never stored (only its SHA-256, as with sessions), use
 * marks the row consumed, and expiry is a column, not a hope.
 *
 * ## Enumeration resistance
 *
 * Requesting a link for an address that is not registered answers exactly
 * like requesting one for an address that is: the API enqueues nothing and
 * sends nothing, and returns the same message either way. Distinguishing
 * them confirms whether an address holds an account, which is how a list
 * of addresses becomes a list of targets. The links themselves are
 * indistinguishable too: used, expired, unknown, and wrong-purpose all
 * answer identically, because distinguishing them is the same oracle one
 * step later.
 *
 * ## Delivery goes through the queue, not around it
 *
 * Each link enqueues a `Notification` row and the dispatch job sends it —
 * the same transport, the same lease, the same retry ceiling as every
 * other email. The service never touches the transport directly, because
 * a second sending path is a second place where "sent" can mean two
 * different things.
 *
 * In development the console sink logs the rendered message, so the link
 * is readable in the operator's log without an inbox. The URL carries the
 * raw token once; the digest is what the database holds.
 */
@Injectable()
export class AuthLinksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  /** Magic links live a quarter of an hour. A link that lives longer is a
   *  password with extra steps. */
  static readonly MAGIC_LINK_TTL_MS = 15 * 60_000;
  /** Resets live an hour. Long enough to reach an inbox; short enough that
   *  a leaked link is a stale one. */
  static readonly RESET_TTL_MS = 60 * 60_000;

  /** At most this many live links per account per purpose. A flood of
   *  outstanding links is a flood of live bearer credentials. */
  static readonly MAX_LIVE_PER_PURPOSE = 5;

  /**
   * Issue a magic link, or pretend to. Either way the answer is the same.
   */
  async requestMagicLink(email: string): Promise<{ message: string }> {
    const normalised = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalised },
      select: { id: true, email: true, displayName: true, status: true },
    });

    await this.audit.record({
      actorId: user?.id ?? null,
      action: 'auth.magic-link.requested',
      targetType: 'User',
      targetId: user?.id,
      outcome: user ? 'success' : 'denied',
      metadata: { email: normalised },
    });

    // Unregistered, suspended, or otherwise unknown: same answer, no row.
    if (!user || user.status !== 'active') {
      return { message: 'If that address holds an account, a sign-in link is on its way.' };
    }

    await this.prune(user.id, 'magic_link');
    const { raw } = await this.issue(user.id, 'magic_link', AuthLinksService.MAGIC_LINK_TTL_MS);

    await this.notifications.enqueue({
      userId: user.id,
      channel: 'email',
      template: 'auth.magic-link',
      payload: { name: user.displayName ?? user.email, link: this.clientLink('/auth/magic', raw) },
    });
    return { message: 'If that address holds an account, a sign-in link is on its way.' };
  }

  /**
   * Exchange a magic link for a session. Single-use: the consume query
   * repeats the unconsumed-and-unexpired predicate on the write, so two
   * requests racing for the same link cannot both succeed.
   */
  async consumeMagicLink(
    raw: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ user: SessionUser; token: string; expiresAt: Date }> {
    const userId = await this.consume(raw, 'magic_link');
    const { token, expiresAt } = await this.issueSession(userId, meta);
    await this.prisma.user
      .update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
      .catch(() => undefined);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'auth.magic-link.consumed',
      targetType: 'User',
      targetId: user.id,
      outcome: 'success',
    });
    return { user, token, expiresAt };
  }

  /**
   * Issue a password-reset link, or pretend to. Same enumeration rule as
   * the magic link: the answer never says whether the address is known.
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const normalised = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalised },
      select: { id: true, email: true, displayName: true, status: true },
    });

    await this.audit.record({
      actorId: user?.id ?? null,
      action: 'auth.password-reset.requested',
      targetType: 'User',
      targetId: user?.id,
      outcome: user ? 'success' : 'denied',
      metadata: { email: normalised },
    });

    if (!user || user.status !== 'active') {
      return { message: 'If that address holds an account, a reset link is on its way.' };
    }

    await this.prune(user.id, 'password_reset');
    const { raw } = await this.issue(user.id, 'password_reset', AuthLinksService.RESET_TTL_MS);

    await this.notifications.enqueue({
      userId: user.id,
      channel: 'email',
      template: 'auth.password-reset',
      payload: { name: user.displayName ?? user.email, link: this.clientLink('/auth/reset', raw) },
    });
    return { message: 'If that address holds an account, a reset link is on its way.' };
  }

  /**
   * Set a new password under a reset link. Consumes the link first, so a
   * failure after consumption cannot be replayed — and a success revokes
   * every session, because the credential every one of them was issued
   * under just changed.
   */
  async resetPassword(
    raw: string,
    password: string,
    hash: (plain: string) => Promise<string>,
  ): Promise<void> {
    const userId = await this.consume(raw, 'password_reset');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordDigest: await hash(password) },
    });
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      actorId: userId,
      action: 'auth.password-reset.consumed',
      targetType: 'User',
      targetId: userId,
      outcome: 'success',
    });
  }

  private async issue(userId: string, purpose: 'magic_link' | 'password_reset', ttlMs: number) {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.authToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashSessionToken(raw),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return { raw };
  }

  private async prune(userId: string, purpose: 'magic_link' | 'password_reset'): Promise<void> {
    // Oldest first past the cap: the newest links are the ones the holder
    // is most likely holding. Revoking the newest instead would strand the
    // link already in the holder's inbox.
    const live = await this.prisma.authToken.findMany({
      where: { userId, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const excess = live.length - AuthLinksService.MAX_LIVE_PER_PURPOSE + 1;
    if (excess > 0) {
      await this.prisma.authToken.deleteMany({
        where: { id: { in: live.slice(0, excess).map((r) => r.id) } },
      });
    }
  }

  /**
   * Mark one live link consumed and return the account it belongs to.
   * Consumed, expired, unknown, and wrong-purpose all answer identically —
   * distinguishing them is the oracle.
   */
  private async consume(raw: string, purpose: 'magic_link' | 'password_reset'): Promise<string> {
    const now = new Date();
    const updated = await this.prisma.authToken.updateMany({
      where: {
        tokenHash: hashSessionToken(raw.trim()),
        purpose,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (updated.count !== 1) {
      await this.audit.record({
        action: purpose === 'magic_link' ? 'auth.magic-link.consumed' : 'auth.password-reset.consumed',
        targetType: 'AuthToken',
        outcome: 'denied',
      });
      throw AppError.unauthorized('That link is not valid. Request a new one.');
    }
    const token = await this.prisma.authToken.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(raw.trim()) },
      select: { userId: true },
    });
    return token.userId;
  }

  private async issueSession(
    userId: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ token: string; expiresAt: Date }> {
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.auth.sessionTtlHours * 60 * 60 * 1000);
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(raw),
        expiresAt,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent?.slice(0, 512) ?? null,
      },
    });
    return { token: raw, expiresAt };
  }

  private clientLink(path: string, raw: string): string {
    // The web client's address comes from CORS origins: the first origin is
    // the deployment the operator configured, and a link must point
    // somewhere the holder can open it.
    const base = (this.config.http.corsOrigins[0] ?? 'http://localhost:3000').replace(/\/$/, '');
    return `${base}${path}?token=${encodeURIComponent(raw)}`;
  }
}
