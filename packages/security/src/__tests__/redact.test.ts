import { describe, expect, it } from 'vitest';
import { redact, redactDeep } from '../index.js';

const SEED = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

describe('secret redaction', () => {
  it('redacts a BIP-39 style mnemonic', () => {
    expect(redact(`my seed is ${SEED} ok`)).toContain('[REDACTED:SEED_PHRASE]');
  });

  it('redacts a 32-byte hex private key', () => {
    const key = `0x${'a'.repeat(64)}`;
    expect(redact(`key=${key}`)).toContain('[REDACTED:HEX_KEY]');
  });

  it('redacts by key name regardless of value shape', () => {
    expect(redactDeep({ note: 'hello', seedPhrase: 'anything at all' }))
      .toEqual({ note: 'hello', seedPhrase: '[REDACTED]' });
  });

  it('recurses into nested structures', () => {
    const out = redactDeep({ a: { b: [{ mnemonic: SEED }] } });
    expect(JSON.stringify(out)).toContain('[REDACTED]');
  });
});
