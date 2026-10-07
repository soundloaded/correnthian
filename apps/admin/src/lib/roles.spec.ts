import { describe, expect, it } from 'vitest';
import { CONSOLE_MIN_ROLE, canAccessConsole, roleAtLeast } from './roles';

describe('canAccessConsole', () => {
  it('admits every staff role', () => {
    for (const role of ['support', 'compliance', 'admin', 'owner']) {
      expect(canAccessConsole(role), role).toBe(true);
    }
  });

  it('refuses a customer account', () => {
    expect(canAccessConsole('user')).toBe(false);
  });

  it('refuses when there is no role at all', () => {
    expect(canAccessConsole(undefined)).toBe(false);
    expect(canAccessConsole(null)).toBe(false);
    expect(canAccessConsole('')).toBe(false);
  });

  it('fails closed on a role it does not know', () => {
    // The API can grow a role before this table learns about it. Admitting an
    // unknown role would open the console by default.
    expect(canAccessConsole('auditor')).toBe(false);
    expect(canAccessConsole('system')).toBe(false);
    expect(canAccessConsole('ADMIN')).toBe(false);
  });

  it('gates at support, one rank above customer', () => {
    expect(CONSOLE_MIN_ROLE).toBe('support');
    expect(canAccessConsole('user')).toBe(false);
    expect(canAccessConsole('support')).toBe(true);
  });
});

describe('roleAtLeast', () => {
  it('ranks in the API order', () => {
    expect(roleAtLeast('user', 'support')).toBe(false);
    expect(roleAtLeast('support', 'support')).toBe(true);
    expect(roleAtLeast('admin', 'compliance')).toBe(true);
    expect(roleAtLeast('support', 'admin')).toBe(false);
    expect(roleAtLeast('owner', 'admin')).toBe(true);
  });

  it('denies an absent or unknown role rather than defaulting in', () => {
    expect(roleAtLeast(undefined, 'support')).toBe(false);
    expect(roleAtLeast('nope', 'user')).toBe(false);
  });
});
