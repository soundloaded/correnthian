import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runWithAuditContext } from './audit-context.js';
import { AuditService } from './audit.service.js';
import { DESTRUCTIVE_ACTIONS, isDestructive } from './destructive-actions.js';

describe('AuditService', () => {
  let create: ReturnType<typeof vi.fn>;
  let svc: AuditService;

  beforeEach(() => {
    create = vi.fn().mockResolvedValue({ id: 'log1' });
    svc = new AuditService({
      auditLog: { create, findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    } as never);
  });

  const lastWrite = () => create.mock.calls.at(-1)?.[0]?.data;

  describe('redaction', () => {
    it('redacts metadata on the way in', async () => {
      await svc.record({
        action: 'provider.disabled',
        metadata: { reason: 'outage', apiSecret: 'super-secret-value' },
      });
      expect(lastWrite().metadata).toEqual({ reason: 'outage', apiSecret: '[REDACTED]' });
    });

    it('redacts a before/after snapshot too — a row is the biggest surface there is', async () => {
      await svc.record({
        action: 'account.suspended',
        before: { status: 'active', passwordDigest: '$argon2id$v=19$...' },
        after: { status: 'suspended', passwordDigest: '$argon2id$v=19$...' },
      });
      expect(lastWrite().before).toEqual({ status: 'active', passwordDigest: '[REDACTED]' });
      expect(lastWrite().after).toEqual({ status: 'suspended', passwordDigest: '[REDACTED]' });
    });

    it('catches a mnemonic that arrived as an ordinary string', async () => {
      await svc.record({
        action: 'note.updated',
        metadata: { note: 'legal winner thank year wave sausage worth useful legal winner thank yellow' },
      });
      expect(String(lastWrite().metadata.note)).toContain('[REDACTED:SEED_PHRASE]');
    });
  });

  describe('the request is the source of requestId, deviceId and IP', () => {
    it('threads them without the caller passing any of them', async () => {
      await runWithAuditContext(
        { requestId: 'req-42', ipAddress: '203.0.113.9', deviceId: 'dev-7' },
        () => svc.record({ action: 'asset.disabled', reason: 'delisted by issuer' }),
      );
      expect(lastWrite()).toMatchObject({
        requestId: 'req-42',
        ipAddress: '203.0.113.9',
        deviceId: 'dev-7',
      });
    });

    it('lets an explicit value win, for work that has no request', async () => {
      await runWithAuditContext({ requestId: 'req-42' }, () =>
        svc.record({ action: 'wallet.synced', requestId: 'job-1' }),
      );
      expect(lastWrite().requestId).toBe('job-1');
    });

    it('writes nulls rather than failing outside a request', async () => {
      await svc.record({ action: 'wallet.synced' });
      expect(lastWrite()).toMatchObject({ requestId: null, deviceId: null, ipAddress: null });
    });
  });

  describe('record never takes down the operation it is auditing', () => {
    it('swallows a database failure', async () => {
      create.mockRejectedValue(new Error('connection terminated unexpectedly'));
      await expect(svc.record({ action: 'wallet.synced' })).resolves.toBeUndefined();
    });

    it('writes the line even when a required reason is missing, so the trail has no holes', async () => {
      // The requirement is enforced at `recordChange`, before the mutation.
      // Refusing here would leave a destructive change with no record at all.
      await svc.record({ action: DESTRUCTIVE_ACTIONS.PROVIDER_DISABLED });
      expect(create).toHaveBeenCalledTimes(1);
      expect(lastWrite().reason).toBeNull();
    });
  });

  describe('recordChange', () => {
    it('derives before and after from two versions of the row', async () => {
      const change = await svc.recordChange({
        actorId: 'admin-1',
        actorRole: 'admin',
        action: 'asset.updated',
        targetType: 'Asset',
        targetId: 'a1',
        before: { symbol: 'XAU', enabled: true, updatedAt: new Date(0) },
        after: { symbol: 'XAU', enabled: false, updatedAt: new Date(1000) },
      });

      expect(change.changed).toEqual(['enabled', 'updatedAt']);
      expect(lastWrite().before).toEqual({ enabled: true, updatedAt: '1970-01-01T00:00:00.000Z' });
      expect(lastWrite().after).toEqual({ enabled: false, updatedAt: '1970-01-01T00:00:01.000Z' });
    });

    it('records a create with before null', async () => {
      await svc.recordChange({ action: 'issuer.created', after: { slug: 'acme' } });
      expect(lastWrite().before).toBeUndefined();
      expect(lastWrite().after).toEqual({ slug: 'acme' });
    });

    it('skips the write when the two rows are identical', async () => {
      const change = await svc.recordChange({ action: 'asset.updated', before: { a: 1 }, after: { a: 1 } });
      expect(change.changed).toEqual([]);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('a destructive operation owes a reason', () => {
    for (const action of Object.values(DESTRUCTIVE_ACTIONS)) {
      it(`refuses ${action} with no reason, before anything is written`, async () => {
        await expect(
          svc.recordChange({ action, before: { enabled: true }, after: { enabled: false } }),
        ).rejects.toThrow(/needs a reason of at least 8 characters/);
        expect(create).not.toHaveBeenCalled();
      });
    }

    it('accepts one, and stores it on the entry', async () => {
      await svc.recordChange({
        action: DESTRUCTIVE_ACTIONS.PROVIDER_DISABLED,
        reason: 'Provider outage — settlements were failing since 04:10 UTC.',
        before: { status: 'active' },
        after: { status: 'disabled' },
      });
      expect(lastWrite().reason).toMatch(/Provider outage/);
    });

    it('takes the reason from the request context, which is how the guard passes it', async () => {
      await runWithAuditContext(
        { requestId: 'req-1', reason: 'Issuer withdrew the attestation.' },
        () => svc.recordChange({
          action: DESTRUCTIVE_ACTIONS.ASSET_DISABLED,
          before: { enabled: true },
          after: { enabled: false },
        }),
      );
      expect(lastWrite()).toMatchObject({ reason: 'Issuer withdrew the attestation.', requestId: 'req-1' });
    });

    it('rejects a placeholder that is long enough to pass a length check', async () => {
      await expect(
        svc.recordChange({ action: DESTRUCTIVE_ACTIONS.CHAIN_DISABLED, reason: '   ' }),
      ).rejects.toThrow();
    });

    it('does not demand one for ordinary work', async () => {
      await expect(
        svc.recordChange({ action: 'asset.updated', before: { symbol: 'X' }, after: { symbol: 'Y' } }),
      ).resolves.toBeDefined();
      expect(lastWrite().reason).toBeNull();
    });

    it('lets a caller mark an action the suffix rule cannot see', async () => {
      await expect(
        svc.recordChange({ action: 'session.purge', destructive: true }),
      ).rejects.toThrow(/needs a reason/);
    });
  });

  describe('the destructive taxonomy', () => {
    it('recognises the four operations §55 names', () => {
      expect(isDestructive('provider.disabled')).toBe(true);
      expect(isDestructive('asset.disabled')).toBe(true);
      expect(isDestructive('chain.disabled')).toBe(true);
      expect(isDestructive('account.suspended')).toBe(true);
      expect(isDestructive('verifiedTier.changed')).toBe(true);
    });

    it('recognises a nested spelling without it having to be registered', () => {
      expect(isDestructive('provider.status.disabled')).toBe(true);
      expect(isDestructive('wallet.revoked')).toBe(true);
    });

    it('leaves ordinary operations alone', () => {
      for (const action of [
        'wallet.synced', 'redemption.shipped', 'transaction.confirmed',
        'provider.status.updated', 'asset.created', 'user.login',
      ]) {
        expect(isDestructive(action), action).toBe(false);
      }
    });
  });
});