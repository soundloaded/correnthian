import { randomBytes, timingSafeEqual } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { AppError } from '../common/errors.js';
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

    return { id: session.user.id, email: session.user.email, role: session.user.role };
  }

  async revokeSession(raw: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: this.hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
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
      throw AppError.conflict('Unable to create account with those details');
    }

    const user = await this.prisma.user.create({
      data: { email: normalised, passwordDigest: await this.hashPassword(password) },
      select: { id: true, email: true, role: true },
    });

    const { token, expiresAt } = await this.issueSession(user.id);
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

    if (!record || !ok) throw AppError.unauthorized('Invalid credentials');

    const { token, expiresAt } = await this.issueSession(record.id);
    return {
      user: { id: record.id, email: record.email, role: record.role },
      token,
      expiresAt,
    };
  }
}

/**
 * A syntactically valid argon2 digest of a value nobody knows, used to keep
 * the failure path's timing comparable to the success path.
 */
const DUMMY_DIGEST =
  '$argon2id$v=19$m=65536,t=3,p=1$c29tZXNhbHR2YWx1ZQ$Z6Q0Cq8vJ0m0Yq0hV0k0Kq0Wq0hV0k0Kq0hV0k0Kq0';
