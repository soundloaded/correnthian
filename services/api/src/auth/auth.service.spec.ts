import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../config/config.service.js';
import { AuthService, DUMMY_DIGEST } from './auth.service.js';

const config = {
  auth: { argon2Memory: 65536, argon2Time: 3, argon2Parallelism: 1, sessionTtlHours: 1 },
} as unknown as ConfigService;

function makePrisma() {
  return {
    session: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    user: { findUnique: vi.fn(), create: vi.fn() },
  };
}

function makeAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let auth: AuthService;

  beforeEach(() => {
    prisma = makePrisma();
    auth = new AuthService(prisma as never, config, makeAudit() as never);
  });

  it('never persists the raw session token — only its digest', async () => {
    const { token } = await auth.issueSession('user-1');
    const call = prisma.session.create.mock.calls[0];
    expect(call).toBeDefined();
    const stored = call?.[0]?.data;

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
      user: { id: 'u1', email: 'a@b.c', role: 'user', status: 'active' },
    });
    await expect(auth.resolveSession('whatever')).rejects.toThrow(/Invalid or expired/);
  });

  it('rejects a revoked session', async () => {
    prisma.session.findUnique.mockResolvedValue({
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'u1', email: 'a@b.c', role: 'user', status: 'active' },
    });
    await expect(auth.resolveSession('whatever')).rejects.toThrow(/Invalid or expired/);
  });

  it('resolves a live session to the user', async () => {
    prisma.session.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'u1', email: 'a@b.c', role: 'admin', status: 'active' },
    });
    await expect(auth.resolveSession('t')).resolves.toEqual({
      id: 'u1', email: 'a@b.c', role: 'admin',
    });
  });

  it('locks out a suspended account on its next request, live token or not', async () => {
    prisma.session.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'u1', email: 'a@b.c', role: 'user', status: 'suspended' },
    });
    await expect(auth.resolveSession('t')).rejects.toThrow(/Invalid or expired/);
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

  it('answers a raced registration with the same generic conflict', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(Object.assign(new Error('Unique constraint'), { code: 'P2002' }));
    await expect(auth.register('fresh@example.com', 'a'.repeat(12)))
      .rejects.toThrow(/Unable to create account/);
  });

  it('keeps a computable dummy digest — a hand-shaped one fails parsing in ~1ms and reopens the timing oracle', () => {
    // 16-byte salt (22 chars) and 32-byte hash (43 chars): exactly what
    // verify() must chew through for the miss path to cost what a real
    // verification costs.
    expect(DUMMY_DIGEST).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
  });

  it('runs the miss-path verification instead of rejecting the digest', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(auth.login('nobody@example.com', 'wrong-password'))
      .rejects.toThrow(/Invalid credentials/);
  });
});
