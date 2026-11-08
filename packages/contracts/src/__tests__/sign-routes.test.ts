import { describe, expect, it } from 'vitest';
import { CONTRACT_REGISTRY } from '../schemas.js';

const UNSIGNED = {
  to: '0x3333333333333333333333333333333333333333',
  value: '0',
  data: '0xdead',
  chainId: 1,
  nonce: 7,
  gas: '100000',
  maxFeePerGas: '2',
  maxPriorityFeePerGas: '1',
};

const RAW_ROW = {
  id: 'tx1',
  userId: 'u1',
  walletId: 'w1',
  assetId: 'asset-usdc',
  chainId: '1',
  providerId: null,
  destination: '0x3333333333333333333333333333333333333333',
  txHash: '0x' + 'ab'.repeat(32),
  direction: 'out',
  state: 'broadcast',
  amountRaw: '1000000',
  amountUsd: null,
  feeRaw: '200000',
  feeUsd: null,
  blockNumber: null,
  confirmations: 0,
  requiredConfirmations: 12,
  droppedAt: null,
  dropCount: 0,
  lastSeenAt: null,
  metadata: null,
  errorCode: null,
  errorMessage: null,
  expiresAt: null,
  signedAt: '2026-11-08T12:00:00.000Z',
  broadcastAt: '2026-11-08T12:00:01.000Z',
  confirmedAt: null,
  failedAt: null,
  blockTime: null,
  createdAt: '2026-11-08T11:59:00.000Z',
  updatedAt: '2026-11-08T12:00:01.000Z',
};

describe('sign-route success contracts', () => {
  it('parses a prepare body of approve then swap', () => {
    const body = {
      quoteId: 'q1',
      transactions: [
        { id: 'tx1', kind: 'approve', unsigned: UNSIGNED },
        { id: 'tx2', kind: 'swap', unsigned: { ...UNSIGNED, nonce: 8 } },
      ],
    };
    expect(CONTRACT_REGISTRY['POST /api/v1/swaps/quotes/:id/prepare'].safeParse(body).success).toBe(true);
  });

  it('parses an assembled unsigned transaction, including a missing fee', () => {
    const body = {
      id: 'tx1',
      state: 'created',
      chainId: '1',
      walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      assetId: '1:0x1111111111111111111111111111111111111111:circle',
      destination: UNSIGNED.to,
      amountRaw: '1000000',
      unsigned: UNSIGNED,
      fee: { raw: '200000', nativeSymbol: 'ETH' },
    };
    const registry = CONTRACT_REGISTRY['POST /api/v1/transactions/:id/build'];
    expect(registry.safeParse(body).success).toBe(true);
    expect(registry.safeParse({ ...body, fee: null }).success).toBe(true);
  });

  it('parses a broadcast success as the transaction row', () => {
    expect(CONTRACT_REGISTRY['POST /api/v1/transactions/:id/broadcast'].safeParse(RAW_ROW).success).toBe(true);
  });
});
