/**
 * Chain & Token API - Now powered by PushChain
 * Keeps the same interface so ExchangePage doesn't break
 */

import { PUSHCHAIN_TOKENS, PUSHCHAIN_RPC, PUSHCHAIN_CHAIN_ID } from "@/lib/pushchain/amm";

export interface RelayCurrency {
  id: string;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
}

export interface RelayChain {
  id: number;
  name: string;
  displayName: string;
  iconUrl?: string;
  logoUrl?: string;
  vmType?: string;
  currency?: {
    id: string;
    symbol: string;
    name: string;
    address?: string;
    decimals: number;
  };
  erc20Currencies?: RelayCurrency[];
  featuredTokens?: (RelayCurrency & { metadata?: { logoURI?: string } })[];
}

// Return PushChain as the only chain
export async function getChains(): Promise<RelayChain[]> {
  return [
    {
      id: PUSHCHAIN_CHAIN_ID,
      name: "Push Chain",
      displayName: "Push Chain (Testnet)",
      iconUrl: "/profile/profile-logo.png",
      logoUrl: "/profile/profile-logo.png",
      vmType: "evm",
      currency: {
        id: "pc",
        symbol: "PC",
        name: "Push Chain",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
      },
      featuredTokens: PUSHCHAIN_TOKENS.map((t) => ({
        id: t.address,
        symbol: t.symbol,
        name: t.name,
        address: t.address,
        decimals: t.decimals,
        logoURI: t.logoURI,
        metadata: { logoURI: t.logoURI },
      })),
    },
  ];
}

export function getTokensForChain(chain: RelayChain): RelayCurrency[] {
  const native: RelayCurrency = {
    id: chain.currency?.address || "0x0000000000000000000000000000000000000000",
    symbol: chain.currency?.symbol || "PC",
    name: chain.currency?.name || "Push Chain",
    address: chain.currency?.address || "0x0000000000000000000000000000000000000000",
    decimals: chain.currency?.decimals || 18,
    logoURI: chain.logoUrl || chain.iconUrl,
  };

  const featured = (chain.featuredTokens || []).map((t) => ({
    id: t.id || t.address,
    symbol: t.symbol,
    name: t.name,
    address: t.address,
    decimals: t.decimals,
    logoURI: t.metadata?.logoURI || t.logoURI,
  }));

  const seen = new Set<string>();
  const result: RelayCurrency[] = [];
  seen.add(native.address.toLowerCase());
  result.push(native);
  for (const t of featured) {
    const key = t.address.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }
  return result;
}
