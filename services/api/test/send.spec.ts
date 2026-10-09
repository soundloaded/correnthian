import 'dotenv/config';
import { createServer, type Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encodeFunctionData, erc20Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * BE-602 over HTTP: intent → build → sign → broadcast, with the real
 * adapter and a stub node.
 *
 * The service specs prove the rules; this proves the wiring — that
 * `TransactionsService` actually receives a `BlockchainService` after the
 * module graph changed to allow it (a circular graph resolves to
 * `undefined`, which compiles and fails at runtime), and that the two new
 * routes exist with their guards, their validation and their status codes.
 *
 * The chain is pointed at a local stub: only public reads are involved, and
 * a third-party RPC would make this test depend on someone else's uptime.
 * The payload is signed for real with a throwaway key whose address is the
 * wallet, because signature recovery — not a fixture — is what the relay
 * checks.
 *
 * Tests run in file order: each builds on the intent the previous one
 * advanced, which is the flow itself.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

const KEY = `0x${'22'.repeat(32)}` as const;
const account = privateKeyToAccount(KEY);
const STRANGER = privateKeyToAccount(`0x${'33'.repeat(32)}` as const);

const DEST = `0x${'d'.repeat(40)}` as `0x${string}`;
const TUSDT_CONTRACT = `0x${'0'.repeat(39)}1`;
const TUSDT_ASSET = `1:${TUSDT_CONTRACT}:dev-fixtures`;
const STUB_HASH = `0x${'7'.repeat(64)}`;

/** Fees the stub advertises: base fee 7, tip 1 gwei → cap 1000000008. */
const TIP = 1_000_000_000n;
const CAP = 1_000_000_008n;
const GAS = 50_000n;

interface RpcCall { id: number; method: string; params?: unknown[] }

function startStubRpc(): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const parsed = JSON.parse(body || '[]') as RpcCall | RpcCall[];
      const one = (m: RpcCall) => {
        switch (m.method) {
          case 'eth_chainId': return '0x1';
          case 'eth_estimateGas': {
            const call = (m.params?.[0] ?? {}) as { data?: string };
            return call.data && call.data !== '0x' ? '0xc350' : '0x5208';
          }
          case 'eth_getTransactionCount': return '0x0';
          case 'eth_maxPriorityFeePerGas': return '0x3b9aca00';
          case 'eth_gasPrice': return '0x3b9aca00';
          case 'eth_sendRawTransaction': return STUB_HASH;
          case 'eth_getBlockByNumber':
            return {
              number: '0x64', hash: `0x${'b'.repeat(64)}`, parentHash: `0x${'c'.repeat(64)}`,
              timestamp: '0x0', transactionsRoot: `0x${'0'.repeat(64)}`,
              stateRoot: `0x${'0'.repeat(64)}`, receiptsRoot: `0x${'0'.repeat(64)}`,
              miner: `0x${'0'.repeat(40)}`, difficulty: '0x0', totalDifficulty: '0x0',
              extraData: '0x', size: '0x0', gasLimit: '0x1c9c380', gasUsed: '0x5208',
              baseFeePerGas: '0x7', uncles: [], transactions: [], logsBloom: `0x${'0'.repeat(512)}`,
            };
          default: return null;
        }
      };
      const out = Array.isArray(parsed)
        ? parsed.map((m, i) => ({ jsonrpc: '2.0', id: m.id ?? i, result: one(m) }))
        : { jsonrpc: '2.0', id: parsed.id, result: one(parsed) };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out));
    });
  });
  return new Promise<{ server: Server; port: number }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: typeof addr === 'object' && addr ? addr.port : 0 });
    });
  });
}


describe.skipIf(!HAS_DB && !CI)('BE-602 — assemble, sign, relay over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let stub: { server: Server; port: number };
  let token = '';
  let strangerToken = '';
  let walletId = '';
  let intentId = '';
  let broadcastIntentId = '';
  let originalRpcUrls: string[] = [];

  const post = async (path: string, body?: unknown, auth = token) => {
    const req = request(app.getHttpServer())
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${auth}`);
    return body === undefined ? await req : await req.send(body as object);
  };

  /** Sign an intent's payload exactly as the server would assemble it. */
  const signIntent = async (opts?: { from?: typeof account; to?: string; value?: bigint; chainId?: number }) => {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [DEST, 1_000_000n],
    });
    return (opts?.from ?? account).signTransaction({
      type: 'eip1559',
      chainId: opts?.chainId ?? 1,
      nonce: 0,
      gas: GAS,
      maxFeePerGas: CAP,
      maxPriorityFeePerGas: TIP,
      to: (opts?.to ?? TUSDT_CONTRACT) as `0x${string}`,
      value: opts?.value ?? 0n,
      data,
    });
  };

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/12`;

    stub = await startStubRpc();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    const chain = await prisma.chain.findUniqueOrThrow({ where: { id: '1' } });
    originalRpcUrls = chain.rpcUrls;
    await prisma.chain.update({ where: { id: '1' }, data: { rpcUrls: [`http://127.0.0.1:${stub.port}`] } });

    const reg = await post('/auth/register', {
      email: `send-spec-${Date.now()}@example.test`,
      password: 'correct-horse-battery-staple',
    });
    expect(reg.status, `register: ${JSON.stringify(reg.body)}`).toBe(201);
    token = reg.body.token;

    const reg2 = await post('/auth/register', {
      email: `send-spec-other-${Date.now()}@example.test`,
      password: 'correct-horse-battery-staple',
    });
    expect(reg2.status).toBe(201);
    strangerToken = reg2.body.token;

    const wallet = await post('/wallets', {
      chainId: '1',
      address: account.address,
      kind: 'smart',
      label: 'send-spec',
    });
    expect(wallet.status, `wallet: ${JSON.stringify(wallet.body)}`).toBe(201);
    walletId = wallet.body.id;
  }, 90_000);

  afterAll(async () => {
    if (prisma && walletId) {
      await prisma.transaction.deleteMany({ where: { walletId } });
      await prisma.wallet.deleteMany({ where: { id: walletId } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'send-spec' } } });
      await prisma.chain.update({ where: { id: '1' }, data: { rpcUrls: originalRpcUrls } });
    }
    if (stub) stub.server.close();
    await app?.close();
    delete process.env['RATE_LIMIT_MAX_REQUESTS'];
    delete process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'];
    delete process.env['REDIS_URL'];
  });

  it('POST /transactions/:id/build returns a signable payload and records the fee shown', async () => {
    const intent = await post('/transactions', {
      walletId,
      assetId: TUSDT_ASSET,
      direction: 'out',
      amountRaw: '1000000',
      destination: DEST,
    });
    expect(intent.status, `intent: ${JSON.stringify(intent.body)}`).toBe(201);
    intentId = intent.body.id;

    const res = await post(`/transactions/${intentId}/build`);
    expect(res.status, `build: ${JSON.stringify(res.body)}`).toBe(201);

    expect(res.body).toMatchObject({
      id: intentId,
      state: 'created',
      chainId: '1',
      walletAddress: account.address,
      fee: { raw: '50000000400000', nativeSymbol: 'ETH' },
    });
    // Everything a device needs: the assembly went through the real adapter.
    expect(res.body.unsigned).toMatchObject({
      chainId: 1,
      to: TUSDT_CONTRACT,
      value: '0',
      nonce: 0,
      gas: '50000',
      maxFeePerGas: '1000000008',
      maxPriorityFeePerGas: '1000000000',
    });
    expect(String(res.body.unsigned.data).startsWith('0xa9059cbb')).toBe(true);

    const row = await prisma.transaction.findUniqueOrThrow({ where: { id: intentId } });
    expect(row.state).toBe('created');
    expect(row.feeRaw?.toString()).toBe('50000000400000');
    expect((row.metadata as { build?: { nonce?: number } })?.build?.nonce).toBe(0);
  }, 30_000);

  it('POST /transactions/:id/build refuses an intent that belongs to someone else', async () => {
    const res = await post(`/transactions/${intentId}/build`, undefined, strangerToken);
    expect(res.status).toBe(404);
  });

  it('POST /transactions/:id/broadcast relays a payload that matches the intent', async () => {
    const signed = await post(`/transactions/${intentId}/transitions`, { to: 'signed' });
    expect(signed.status, JSON.stringify(signed.body)).toBe(201);
    expect(signed.body.state).toBe('signed');

    const res = await post(`/transactions/${intentId}/broadcast`, {
      signed: await signIntent(),
    });
    expect(res.status, `broadcast: ${JSON.stringify(res.body)}`).toBe(201);
    expect(res.body).toMatchObject({ state: 'broadcast', txHash: STUB_HASH });

    const row = await prisma.transaction.findUniqueOrThrow({ where: { id: intentId } });
    expect(row.state).toBe('broadcast');
    expect(row.txHash).toBe(STUB_HASH);
  }, 30_000);

  it('POST /transactions/:id/broadcast refuses a payload signed by another account', async () => {
    const intent = await post('/transactions', {
      walletId,
      assetId: TUSDT_ASSET,
      direction: 'out',
      amountRaw: '1000000',
      destination: DEST,
    });
    expect(intent.status).toBe(201);
    broadcastIntentId = intent.body.id;

    await post(`/transactions/${broadcastIntentId}/transitions`, { to: 'signed' });

    const res = await post(`/transactions/${broadcastIntentId}/broadcast`, {
      signed: await signIntent({ from: STRANGER }),
    });
    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error.message).toMatch(/different account/i);

    const row = await prisma.transaction.findUniqueOrThrow({ where: { id: broadcastIntentId } });
    expect(row.state).toBe('signed');
    expect(row.txHash).toBeNull();
  }, 30_000);

  it('POST /transactions/:id/broadcast refuses before the signature has been reported', async () => {
    const intent = await post('/transactions', {
      walletId,
      assetId: TUSDT_ASSET,
      direction: 'out',
      amountRaw: '1000000',
      destination: DEST,
    });
    expect(intent.status).toBe(201);

    const res = await post(`/transactions/${intent.body.id}/broadcast`, {
      signed: await signIntent(),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Report the signature first/i);
  }, 30_000);

  it('POST /transactions/:id/broadcast refuses bytes that are not a transaction', async () => {
    await post(`/transactions/${broadcastIntentId}/transitions`, { to: 'signed' })
      .catch(() => undefined);
    // The row is already `signed` from the stranger test, so this lands on
    // decode — which must reject the bytes rather than relaying them.
    const res = await post(`/transactions/${broadcastIntentId}/broadcast`, { signed: '0xdead' });
    expect(res.status).toBe(400);
  }, 30_000);

  it('both new routes refuse an anonymous caller', async () => {
    const noAuth = request(app.getHttpServer()).post(`/api/v1/transactions/${intentId}/build`);
    const buildAnon = await noAuth;
    expect(buildAnon.status).toBe(401);

    const bc = await request(app.getHttpServer())
      .post(`/api/v1/transactions/${intentId}/broadcast`)
      .send({ signed: '0xdead' });
    expect(bc.status).toBe(401);
  });
});
