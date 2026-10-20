import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { AppError } from '../common/errors.js';
import { AuditService } from '../audit/audit.service.js';
import { hashSessionToken } from './token-hash.js';
import { ConfigService } from '../config/config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ passwords --

  async hashPassword(plain: string): Promise<string> {
    return hash(plain, {
      memoryCost: this.config.auth.argon2Memory,
      timeCost: this.config.auth.argon2Time,
      parallelism: this.config.auth.argon2Parallelism,
    });
  }

  async verifyPassword(digest: string, plain: string): Promise<boolean> {
    try {
      return await verify(digest, plain);
    } catch {
      // A malformed stored hash must not be distinguishable from a wrong
      // password to the caller.
      return false;
    }
  }

  // -------------------------------------------------------------- sessions --

  /**
   * The raw token is returned to the client exactly once and never persisted.
   * Only its SHA-256 digest is stored, so a database compromise does not hand
   * an attacker live sessions.
   */
  private mintToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hashToken(raw) };
  }

  private hashToken(raw: string): string {
    return hashSessionToken(raw);
  }

  async issueSession(
    userId: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<{ token: string; expiresAt: Date }> {
    const { raw, hash } = this.mintToken();
    const expiresAt = new Date(
      Date.now() + this.config.auth.sessionTtlHours * 60 * 60 * 1000,
    );

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hash,
        expiresAt,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent?.slice(0, 512) ?? null,
      },
    });

    return { token: raw, expiresAt };
  }

  /**
   * Resolve a bearer token to a user, or throw. Expired and revoked sessions
   * are indistinguishable from unknown ones.
   */
  async resolveSession(raw: string): Promise<SessionUser> {
    const tokenHash = this.hashToken(raw);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw AppError.unauthorized('Invalid or expired session');
    }

    // Suspension takes effect on the next request, not at the next login:
    // setStatus revokes sessions in the same call, and this closes the race
    // where a token issued before the suspension would otherwise stay live.
    if (session.user.status !== 'active') {
      throw AppError.unauthorized('Invalid or expired session');
    }

    return { id: session.user.id, email: session.user.email, role: session.user.role };
  }

  async revokeSession(raw: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: this.hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Sign-out that never fails the caller. The session lookup is best-effort
   * forensics, not a gate: a dead token still ends in a revoke attempt and a
   * 204, because "logout with a stale token" must not become an error.
   */
  async logout(raw: string | undefined): Promise<void> {
    if (!raw) return;
    const session = await this.prisma.session
      .findUnique({
        where: { tokenHash: this.hashToken(raw) },
        select: { userId: true },
      })
      .catch(() => null);
    await this.revokeSession(raw);
    await this.audit.record({
      actorId: session?.userId ?? null,
      action: 'auth.logout',
      targetType: 'Session',
      outcome: 'success',
    });
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const { count } = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  // ------------------------------------------------------------------ auth --

  async register(
    email: string,
    password: string,
  ): Promise<{ user: SessionUser; token: string; expiresAt: Date }> {
    const normalised = email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email: normalised } });
    if (existing) {
      // Do not confirm whether an address is registered.
      await this.audit.record({
        action: 'auth.register',
        targetType: 'User',
        outcome: 'denied',
        metadata: { email: normalised },
      });
      throw AppError.conflict('Unable to create account with those details');
    }

    const user = await this.prisma.user.create({
      data: { email: normalised, passwordDigest: await this.hashPassword(password) },
      select: { id: true, email: true, role: true },
    }).catch((err: unknown) => {
      // A concurrent registration for the same address fails the unique
      // index after the existence check above. It must answer with the same
      // generic conflict — the filter's 'Resource already exists' would name
      // which of the two requests won the race.
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        throw AppError.conflict('Unable to create account with those details');
      }
      throw err;
    });

    const { token, expiresAt } = await this.issueSession(user.id);
    await this.audit.record({
      actorId: user.id,
      action: 'auth.register',
      targetType: 'User',
      targetId: user.id,
      outcome: 'success',
      metadata: { email: normalised },
    });
    return { user, token, expiresAt };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ user: SessionUser; token: string; expiresAt: Date }> {
    const record = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // Always run a verification so a missing account and a wrong password
    // take comparable time.
    const digest = record?.passwordDigest ?? DUMMY_DIGEST;
    const ok = await this.verifyPassword(digest, password);

    if (!record || !ok) {
      await this.audit.record({
        actorId: record?.id ?? null,
        action: 'auth.login',
        targetType: 'User',
        targetId: record?.id,
        outcome: 'failure',
        metadata: { email: email.trim().toLowerCase() },
      });
      throw AppError.unauthorized('Invalid credentials');
    }

    const { token, expiresAt } = await this.issueSession(record.id);

    // The account's last sign-in, which the console shows on the users list
    // and the account page. Nothing wrote this column, so it read "—" for
    // every account that had signed in a dozen times — a column that
    // looked live and never was. A failure to stamp it must not fail the
    // sign-in: the session is already issued and the holder must still get
    // in, so the failure is logged rather than thrown.
    try {
      await this.prisma.user.update({
        where: { id: record.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(`Could not stamp lastLoginAt for ${record.id}: ${String(err)}`);
    }

    await this.audit.record({
      actorId: record.id,
      action: 'auth.login',
      targetType: 'User',
      targetId: record.id,
      outcome: 'success',
      metadata: { email: record.email },
    });
    return {
      user: { id: record.id, email: record.email, role: record.role },
      token,
      expiresAt,
    };
  }
}

/**
 * A real argon2id digest of a value nobody knows, used to keep the failure
 * path's timing comparable to the success path.
 *
 * This must stay a digest `verify()` can actually compute: the previous
 * value was hand-shaped, failed parsing in ~1ms against ~200ms for a real
 * verification, and made missing-account versus wrong-password
 * distinguishable by timing — the exact oracle this constant exists to
 * close. It was proven with a stopwatch, not by reading the base64.
 */
export const DUMMY_DIGEST =
  '$argon2id$v=19$m=65536,t=3,p=1$6YhROKZIIuj+FPa5FW9aZg$6lO+YHCRY0hZBH9FZppx3EaScEtQcc3eQmYYHe8CJh8';
