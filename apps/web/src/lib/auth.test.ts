import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, getSession, setSession, type WebSession } from './auth';

const SESSION: WebSession = {
  token: 'tok-1',
  userId: 'u-1',
  email: 'holder@example.com',
  role: 'user',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
});

beforeEach(() => {
  clearSession();
  for (const k of Object.keys(store)) delete store[k];
  vi.unstubAllGlobals();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  });
});

describe('web session', () => {
  it('starts empty', () => {
    expect(getSession()).toBeNull();
  });

  it('survives a set and reads back', () => {
    setSession(SESSION);
    expect(getSession()).toEqual(SESSION);
  });

  it('dies at expiry', () => {
    setSession({ ...SESSION, expiresAt: new Date(Date.now() - 1_000).toISOString() });
    expect(getSession()).toBeNull();
  });

  it('clears the mirror on sign-out', () => {
    setSession(SESSION);
    clearSession();
    expect(getSession()).toBeNull();
    expect(store['correnthian.web.session']).toBeUndefined();
  });
});
