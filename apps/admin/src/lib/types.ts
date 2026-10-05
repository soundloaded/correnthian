export type UserRole = 'user' | 'support' | 'compliance' | 'admin' | 'owner';
export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected' | 'expired';

export interface UserSummary {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  country: string | null;
  region: string | null;
  kycStatus: KycStatus;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { wallets: number; devices: number };
}

export interface UserListResponse { items: UserSummary[]; nextCursor: string | null }

export interface UserStats {
  total: number;
  newLast7d: number;
  byKyc: Partial<Record<KycStatus, number>>;
  byRole: Partial<Record<UserRole, number>>;
}

export interface AssetSummary {
  assetId: string;
  chainId: string;
  contractAddress: string | null;
  symbol: string;
  name: string;
  decimals: number;
  category: string;
  custodyModel: 'allocated' | 'unallocated' | 'synthetic';
  custodian: string | null;
  vaultLocations: string[];
  attestationCadence: string;
  lastAttestation: string | null;
  verifiedTier: 'issuer-verified' | 'community-verified' | 'unverified';
  riskFlags: string[];
  enabled: boolean;
  issuer: { issuerId: string; issuerName: string; jurisdiction: string };
  /** The product's core promise: never render a token as metal without this. */
  disclosure: string;
}

export interface AssetStats {
  total: number;
  enabled: number;
  enabledMetals: number;
  staleAttestations: number;
  byTier: Record<string, number>;
}

export interface Provider {
  id: string; slug: string; name: string; category: string;
  status: 'active' | 'degraded' | 'disabled';
  capabilities: string[]; lastCheckedAt: string | null; notes: string | null;
}

export interface Chain {
  id: string; name: string; family: string; nativeSymbol: string;
  decimals: number; explorerUrl: string | null;
  enabled: boolean; isTestnet: boolean;
  _count: { assets: number; wallets: number };
}
