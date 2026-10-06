# BLOCKCHAINS

`packages/blockchain` — the only way the rest of Correnthian talks to a
network. Everything above it (portfolio, pricing, wallets, admin) is chain
agnostic, so adding Bitcoin or Solana means implementing one interface and
changing nothing else.

Verified against the repository at `2be6499`.

---

## 1. The adapter interface

`packages/blockchain/src/adapter.ts`.

### `BlockchainAdapter`

| Member | Kind | Notes |
|---|---|---|
| `id`, `family` | readonly | `family` is `'evm' \| 'bitcoin' \| 'solana'` |
| `describe()` | read | Returns the `ChainDescriptor` |
| `getBalance(address)` | read | Native balance |
| `getTokenBalance(address, contract)` | read | Returns **zero** for an unknown contract rather than throwing |
| `getTokenBalances(address, contracts[])` | read | One pass; a failing contract resolves to zero and is left visible as such |
| `estimateFee(tx)` | read | Native-currency amount |
| `buildTransaction(req)` | read-ish | **Assembles an unsigned transaction. Never signs.** |
| `broadcastTransaction(signed)` | write | Submits a payload the client already signed |
| `getTransaction(hash)` | read | |
| `getBlockNumber()` | read | |
| `isHealthy()` | read | Drives the readiness view |

Plus `supportsFamily(adapter, family)` as a narrowing helper, so a caller cannot
pass an EVM adapter where Bitcoin is meant.

### `Balance`

```ts
{ raw: string; decimals: number }
```

`raw` is a **decimal string**, never a float. The comment says why: an
18-decimal balance in a double has already lost the low digits before anyone
formats it.

### Signing is deliberately absent

There is no `sign()` on the adapter, and there must never be one.

> Correnthian's servers hold no key, so a signed payload here would be a lie
> about the architecture.

`buildTransaction` assembles something for the client's device to sign.
`broadcastTransaction` submits what came back. This is the adapter-level
expression of ADR-001.

---

## 2. EVM implementation

`packages/blockchain/src/evm.ts`, built on viem ^2.57.3.

### Reads

- `getBalance` → viem `getBalance`.
- `getTokenBalance` → `erc20Abi.balanceOf`. Returns `decimals: 18` — the
  adapter assumes 18 rather than reading the contract's `decimals()`. A token
  with a different value will report wrong units.
- `getTokenBalances` → `Promise.all` over `getTokenBalance`, each wrapped so
  one unreadable contract resolves to `{ raw: '0', decimals: 18 }` and the rest
  of the sweep continues. An unregistered or non-standard token is normal, not
  exceptional.
- `getTransaction` → `confirmed` if `blockNumber` is set, else `pending`.
  **`confirmations` is always 0** and **`blockTime` is always null** — neither is
  implemented. `BE-601` covers the gap.

### `buildTransaction`

Estimates gas with `estimateGas` and returns `{ to, value, data, chainId, gas }`.
Two comments worth preserving:

- `account` is only included when known. Passing a zero address instead would
  silently estimate against a balance nobody holds.
- `estimateGas` is the raw-transaction estimator; `estimateContractGas` is
  typed for ABI calls and rejects a plain value transfer.

### `estimateFee`

`gasPrice * 21000n` — bigint arithmetic, because gas prices exceed what a double
represents exactly. It is a flat 21000-gas estimate regardless of calldata, so
it under-estimates every contract call.

### Amounts

Decimal strings end to end via viem's `parseUnits` / `formatUnits`, which do
exact decimal arithmetic. `formatBalance(raw, decimals)` is the display helper.

---

## 3. RPC failover

`packages/blockchain/src/rpc.ts`.

```ts
new RpcPool([{ url, weight }, ...])
```

### Behaviour

| Rule | Why |
|---|---|
| Sorted by `weight`, lower first | A preferred endpoint is tried first |
| Failover is **per-request**, not sticky | Balances are public data; a read that fails on one endpoint is retried on the next immediately |
| A failing endpoint is **quarantined for 30 s** | Otherwise it is retried on every call |
| If **everything** is quarantined, try it all | A blip must not take the chain offline permanently |
| A success **clears** the endpoint's record | Recovery is immediate, not gradual |
| All endpoints failing → throw naming the count | Distinguishes "the chain is down" from "our configuration is wrong" |
| `health(probe)` reports `{ healthy, total }` | A throwing probe counts as unhealthy rather than propagating |

Ten tests in `packages/blockchain/src/__tests__/rpc.test.ts`, covering rotation,
quarantine, weight preference, the single-endpoint blip case, failure-record
clearing, and health accounting.

### Adapter resolution

`services/api/src/blockchain/blockchain.service.ts`:

- Reads `Chain.rpcUrls` from the database and constructs an `EvmAdapter`.
- **Adapters are cached per chain**, because constructing one builds a viem
  client per endpoint and that is not free on a hot path.
- `invalidate(chainId)` drops the cache — e.g. after RPC configuration changes.
- **No RPC configured is a `providerUnavailable` error**, not a client error:
  "This is a deployment gap, not a client error."
- `health()` iterates chains, reports `{ healthy, enabled }` keyed by **name**,
  and never exposes a URL.

**Note:** the cache has no invalidation on `PATCH /chains/:id/enabled`, and
`rpcUrls` cannot be changed through the API at all. Enabling a chain whose RPC
was configured directly in the database works; re-pointing an RPC needs a
restart.

### Seeded chains

| id | Name | Family | Enabled | Testnet |
|---|---|---|---|---|
| `1` | Ethereum | evm | yes | no |
| `8453` | Base | evm | yes | no |
| `11155111` | Ethereum Sepolia | evm | **no** | yes |

**Seeded with `rpcUrls: []`.** `RPC_ETHEREUM_MAINNET` and friends are in
`.env.example` and read by no code. There is no mechanism that puts an RPC URL
into the database — it must be done by hand. The `BlockChainService` error path
is the one you will hit first.

`WalletsService.FAMILIES` maps chain id to address family and is a separate,
hand-maintained table: `1`, `8453`, `11155111`, `56`, `137`, `42161`, `10` — all
`evm`. Registering a wallet on an unlisted chain is refused rather than guessed.

---

## 4. Address validation

`packages/blockchain/src/address.ts`.

```ts
validateAddress(address, family) -> { valid, family, reason, normalised }
validateEvmAddress / validateBitcoinAddress / validateSolanaAddress
formatAddress(address, lead=6, tail=4)
```

**Validated on the way in**, before storage — a mistyped address is a permanent,
irreversible loss of funds, and rejecting it at registration is far better than
discovering it at signing time. `WalletsService.register` does exactly this and
writes the reason in words a user can act on.

**Unknown families are rejected rather than passed through.** An address we
cannot check is an address we cannot trust.

| Family | Method | Limit |
|---|---|---|
| EVM | Regex `^0x[0-9a-fA-F]{40}$`, then EIP-55 | **Real checksum verification.** See ADR-005. |
| Bitcoin | bech32 `bc1[02-9ac-hj-np-z]{11,71}` or base58 `[13][a-km-zA-HJ-NP-Z1-9]{25,34}` | **Format only.** No checksum, no script-type validation. |
| Solana | Base58, 32–44 chars | **Format only.** Does not decode to confirm a 32-byte ed25519 key length. |

Normalisation: EVM lower-cased for storage, others as supplied.

`formatAddress` is display-only — `0xAbCd…1234`, never to be used in a
transaction.

### DEF-011 — stale comment

The block above `validateEvmAddress` still describes the pre-fix behaviour
("any mixed-case address is refused… `EIP55_SUPPORTED` marks that branch") and
references a constant that does not exist. Verification **is** implemented
below it. An agent reading that comment will believe checksummed addresses are
rejected and may "restore" behaviour that is now a bug.

---

## 5. Indexing

`services/api/src/blockchain/indexing.service.ts`.
`POST /blockchain/wallets/:walletId/sync`.

### What it does

1. Loads the wallet, scoped to the user. Verifies the chain is enabled.
2. Reads the native balance and upserts it against the asset with
   `contractAddress: ''` on that chain.
3. Selects every **enabled** asset on the chain with a non-empty contract and
   reads each balance, upserting into `WalletAccount`.
4. Collects per-contract errors rather than abandoning the sweep.
5. Writes an audit entry with the asset and error counts.

Fetching only enabled assets is deliberate: reading every contract in the
registry for every address would be slow and would invite balances for assets a
user should not be shown.

`assetCount` includes the native read, so it matches `updated.length +
errors.length`.

**Verified live against Sepolia:** 61.060896814128264732 ETH indexed into
`WalletAccount`, and the portfolio correctly reported it as *unpriced* rather
than valuing it at zero.

### What it is not

This is balance sync, not the plan's `BACKEND-05 Indexer`.

- **No events.** Addresses → blockchain events → transactions does not exist.
- **No `Transaction` row is ever written.** The model exists; nothing populates
  it.
- No confirmation counting, no reorg handling, no dropped-transaction detection,
  no backfill, no scheduling.

`BE-302` is `PARTIAL` for this reason.

---

## 6. What is not supported

| Thing | State |
|---|---|
| Bitcoin adapter | **Does not exist.** Format validation only. |
| Solana adapter | **Does not exist.** Format validation only. |
| Transaction lifecycle / confirmations | `Transaction` model only. `getTransaction` returns `confirmations: 0` and `blockTime: null` unconditionally. |
| Event indexing / log indexing | **Does not exist.** |
| ERC-4337 smart accounts | **Does not exist.** No bundler, no paymaster, no account factory. Types only. |
| Gas sponsorship | **Does not exist.** `BUNDLER_RPC_URL` and `PAYMASTER_RPC_URL` are in `.env.example` and read by nothing. |
| Non-standard ERC-20 tokens (fee-on-transfer, rebasing) | Handled as if they were standard. Balances will drift. |
| NFT / ERC-721 / ERC-1155 | Out of scope. `TokenStandard` has no such value. |
| Bridge, wrap/unwrap, liquidity provision | Out of scope. |
| Cross-chain anything | Out of scope. One chain per wallet. |
| Reorg safety | Not implemented. `getTransaction` reads a single block. |

---

## 7. Performance and rate limits

Not characterised. No caching layer over RPC reads, no request coalescing, no
batch endpoint beyond `getTokenBalances` (which is `Promise.all`, not
`multicall`). `EvmAdapter` builds one viem `PublicClient` per endpoint and
caches it per adapter instance, and the adapter itself is cached per chain in
`BlockchainService` — that is the whole performance story.

There is no rate-limit policy against the RPC provider beyond the failover
pool, and no accounting of what a sync costs. Worth noting before anyone points
this at a metered endpoint.