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
  asset: {
    assetId: string;
    chainId: string;
    contractAddress: string | null;
    symbol: string;
    name: string;
    decimals: number;
    category: string;
    issuer: { issuerId: string; issuerName: string; jurisdiction: string };
    backing: {
      custodyModel: 'allocated' | 'unallocated' | 'synthetic';
      custodian: string | null;
      vaultLocation: string[];
      lastAttestation: string | null;
    };
    trust: { verifiedTier: string; riskFlags: string[] };
    enabled: boolean;
    trading: { redeemSupported: boolean };
  };
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

export interface DeviceRow {
  id: string;
  platform: 'ios' | 'android' | 'web';
  label: string;
  trustedAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  user: { id: string; email: string; role: string; kycStatus: KycStatus };
}

export interface DeviceListResponse { items: DeviceRow[]; nextCursor: string | null }

export interface DeviceStats {
  total: number;
  revoked: number;
  stale: number;
  byPlatform: Record<string, number>;
}

export interface Issuer {
  id: string;
  slug: string;
  name: string;
  jurisdiction: string;
  licenseTypes: string[];
  licenseRefs: string[];
  website: string | null;
  verifiedTier: 'issuer_verified' | 'community_verified' | 'unverified';
  riskFlags: string[];
  notes: string | null;
  createdAt: string;
  _count: { assets: number };
}


export interface Provider {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: 'active' | 'degraded' | 'disabled';
  capabilities: string[];
  lastCheckedAt: string | null;
  notes: string | null;
  _count: { quotes: number; redemptions: number };
}

export interface UserDetail {
  id: string;
  email: string;
  role: string;
  status: string;
  displayName: string | null;
  country: string | null;
  region: string | null;
  kycStatus: KycStatus;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  wallets: Array<{
    id: string; address: string; chainId: string; kind: string;
    label: string | null; deployed: boolean; isPrimary: boolean; createdAt: string;
  }>;
  devices: Array<{
    id: string; platform: string; label: string; trustedAt: string; lastSeenAt: string;
  }>;
  kyc: {
    status: KycStatus; provider: string | null; providerRef: string | null;
    jurisdiction: string | null; reviewedAt: string | null;
  } | null;
}
