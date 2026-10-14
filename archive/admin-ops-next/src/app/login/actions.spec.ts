import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.fn();
vi.mock('next/navigation', () => ({ redirect: (...a: unknown[]) => redirect(...a) }));

const setSession = vi.fn();
vi.mock('@/lib/session', () => ({ setSession: (...a: unknown[]) => setSession(...a) }));

import { loginAction } from './actions';

const okBody = (role: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ token: 'tok', user: { id: 'u1', email: 'a@example.com', role } }),
});

const submit = (role: string) => {
  const fd = new FormData();
  fd.set('email', 'a@example.com');
  fd.set('password', 'hunter2hunter2');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okBody(role)));
  return loginAction({}, fd);
};

beforeEach(() => {
  redirect.mockClear();
  setSession.mockReset().mockResolvedValue(undefined);
});

describe('loginAction role gate', () => {
  it('refuses a customer account and writes no session', async () => {
    const state = await submit('user');

    expect(state?.error).toMatch(/does not have access/i);
    expect(setSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('fails closed on a role the table does not know', async () => {
    const state = await submit('auditor');

    expect(state?.error).toMatch(/does not have access/i);
    expect(setSession).not.toHaveBeenCalled();
  });

  it('admits a staff account, stores the session and continues', async () => {
    const state = await submit('support');

    expect(state?.error).toBeUndefined();
    expect(setSession).toHaveBeenCalledTimes(1);
    expect(setSession).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ role: 'support' }),
    );
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it.each(['compliance', 'admin', 'owner'])('admits %s', async (role) => {
    await submit(role);
    expect(setSession).toHaveBeenCalledTimes(1);
  });

  it('still surfaces a rejected credential before any role check', async () => {
    const fd = new FormData();
    fd.set('email', 'a@example.com');
    fd.set('password', 'wrong-password-x');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );

    const state = await loginAction({}, fd);

    expect(state?.error).toBe('Those credentials were not accepted.');
    expect(setSession).not.toHaveBeenCalled();
  });
});
