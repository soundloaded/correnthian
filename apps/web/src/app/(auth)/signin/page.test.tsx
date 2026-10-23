import { describe, expect, it } from 'vitest';
import { authFailureCopy } from './page';

describe('auth failure copy', () => {
  it('never surfaces backend detail', () => {
    expect(authFailureCopy('anything the server said')).toBe(
      'Those credentials were not accepted.',
    );
  });
});
