import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.fn();
vi.mock('next/navigation', () => ({ redirect: (...a: unknown[]) => redirect(...a) }));

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: (...a: unknown[]) => getSession(...a) }));

// The gate is what is under test; the shell it would render is not.
vi.mock('@/components/layout/admin-sidebar', () => ({ AdminSidebar: () => null }));
vi.mock('@/components/layout/site-header', () => ({ SiteHeader: () => null }));

import DashboardLayout from './layout';

const session = (role: string) => ({
  userId: 'u1',
  email: 'a@example.com',
  role,
});

const render = (s: Awaited<ReturnType<typeof getSession>>) =>
  DashboardLayout({ children: null } as never).then(() => s);

beforeEach(() => {
  redirect.mockClear();
  getSession.mockReset();
});

describe('dashboard layout role gate', () => {
  it('sends an anonymous visitor to sign in', async () => {
    getSession.mockResolvedValue(null);
    await render(null);

    expect(redirect).toHaveBeenCalledWith('/login');
    expect(redirect).not.toHaveBeenCalledWith('/unauthorized');
  });

  it('sends a customer account to the no-access page, not the shell', async () => {
    getSession.mockResolvedValue(session('user'));
    await render(session('user'));

    expect(redirect).toHaveBeenCalledWith('/unauthorized');
  });

  it.each(['support', 'compliance', 'admin', 'owner'])(
    'renders the shell for %s without redirecting',
    async (role) => {
      getSession.mockResolvedValue(session(role));
      await render(session(role));

      expect(redirect).not.toHaveBeenCalled();
    },
  );

  it('fails closed on a role it does not know', async () => {
    getSession.mockResolvedValue(session('auditor'));
    await render(session('auditor'));

    expect(redirect).toHaveBeenCalledWith('/unauthorized');
  });
});
