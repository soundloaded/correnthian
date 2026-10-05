import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../config/config.service.js';
import { AuthService } from './auth.service.js';

const config = {
  auth: { argon2Memory: 65536, argon2Time: 3, argon2Parallelism: 1, sessionTtlHours: 1 },
} as unknown as ConfigService;

function makePrisma() {
  return {
    session: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    user: { findUnique: vi.fn(), create: vi.fn() },
  };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let auth: AuthService;

  beforeEach(() => {
    prisma = makePrisma();
    auth = new AuthService(prisma as never, config);
  });

  it('never persists the raw session token — only its digest', async () => {
    const { token } = await auth.issueSession('user-1');
    const stored = prisma.session.create.mock.calls[0][0].data;

    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('issues a different token each time', async () => {
    const a = await auth.issueSession('user-1');
    const b = await auth.issueSession('user-1');
    expect(a.token).not.toBe(b.token);
  });

  it('rejects an expired session', async () => {
    prisma.session.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      user: { id: 'u1', email: 'a@b.c', role: 'user' },
    });
    await expect(auth.resolveSession('whatever')).rejects.toThrow(/Invalid or expired/);
  });

  it('rejects a revoked session', async () => {
    prisma.session.findUnique.mockResolvedValue({
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'u1', email: 'a@b.c', role: 'user' },
    });
    await expect(auth.resolveSession('whatever')).rejects.toThrow(/Invalid or expired/);
  });

  it('resolves a live session to the user', async () => {
    prisma.session.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'u1', email: 'a@b.c', role: 'admin' },
    });
    await expect(auth.resolveSession('t')).resolves.toEqual({
      id: 'u1', email: 'a@b.c', role: 'admin',
    });
  });

  it('gives the same error for an unknown token as for a dead one', async () => {
    prisma.session.findUnique.mockResolvedValue(null);
    await expect(auth.resolveSession('nope')).rejects.toThrow(/Invalid or expired/);
  });

  it('refuses to report whether an address is registered', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await expect(auth.register('taken@example.com', 'a'.repeat(12)))
      .rejects.toThrow(/Unable to create account/);
  });
});
