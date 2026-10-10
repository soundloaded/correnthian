const CHAIN_ENV: Record<string, string> = {
  '1': 'RPC_ETHEREUM_MAINNET',
  '8453': 'RPC_BASE_MAINNET',
  '11155111': 'RPC_ETHEREUM_SEPOLIA',
  '84532': 'RPC_BASE_SEPOLIA',
};

/**
 * Seed-time RPC wiring. Returns existing urls untouched when non-empty so
 * re-seeding never clobbers an operator edit; fills from env only into the
 * gap. Zero imports, so `prisma/seed.ts` can use it under any runner.
 */
export function resolveSeedRpcUrls(chainId: string, existing: string[], env: NodeJS.ProcessEnv): string[] {
  if (existing.length > 0) return existing;
  const name = CHAIN_ENV[chainId];
  const url = name ? env[name] : undefined;
  return typeof url === 'string' && url.length > 0 ? [url] : [];
}
