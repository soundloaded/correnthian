import { describe, expect, it } from 'vitest';
import { resolveSeedRpcUrls } from './chain-rpc.js';

describe('resolveSeedRpcUrls', () => {
  const ENV = {
    RPC_ETHEREUM_MAINNET: 'https://eth.example/v3/key',
    RPC_BASE_MAINNET: 'https://base.example/v3/key',
  };
  it('fills empty urls from env', () => {
    expect(resolveSeedRpcUrls('1', [], ENV)).toEqual(['https://eth.example/v3/key']);
    expect(resolveSeedRpcUrls('8453', [], ENV)).toEqual(['https://base.example/v3/key']);
  });
  it('preserves operator-set urls and never overwrites', () => {
    expect(resolveSeedRpcUrls('1', ['https://ops.example'], ENV)).toEqual(['https://ops.example']);
  });
  it('splits a comma-separated list and keeps order', () => {
    expect(resolveSeedRpcUrls('1', [], {
      RPC_ETHEREUM_MAINNET: ' https://a.example , https://b.example, ',
    })).toEqual(['https://a.example', 'https://b.example']);
  });
  it('does not replace urls an operator already stored', () => {
    expect(resolveSeedRpcUrls('1', ['https://ops.example'], {
      RPC_ETHEREUM_MAINNET: 'https://a.example,https://b.example',
    })).toEqual(['https://ops.example']);
  });
  it('treats an empty-string env value as unset', () => {
    expect(resolveSeedRpcUrls('1', [], { RPC_ETHEREUM_MAINNET: '' })).toEqual([]);
  });
  it('returns empty for unknown chains and empty env', () => {
    expect(resolveSeedRpcUrls('999', [], {})).toEqual([]);
    expect(resolveSeedRpcUrls('1', [], {})).toEqual([]);
  });
});
