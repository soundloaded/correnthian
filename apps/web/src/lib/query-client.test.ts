import { describe, expect, it } from 'vitest';
import { getQueryClient } from './query-client';

describe('web query client', () => {
  it('returns a singleton', () => {
    expect(getQueryClient()).toBe(getQueryClient());
  });
});
