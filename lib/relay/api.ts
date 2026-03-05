/**
 * Chain & Token API — powered by PushChain AMM
 * Returns real PRC-20 tokens deployed on Push Chain Donut Testnet
 */
import { TOKENS, CONTRACTS, PUSHCHAIN_CHAIN_ID, type TokenInfo } from "@/lib/pushchain/contracts";

export interface RelayCurrency {
  id: string;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  sourceChain?: string;
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

export async function getChains(): Promise<RelayChain[]> {
  return [
    {
      id: PUSHCHAIN_CHAIN_ID,
      name: "Push Chain",
      displayName: "Push Chain (Donut Testnet)",
      iconUrl: "https://push.org/assets/website/segments/PushLogoBlack@3x.png",
      logoUrl: "https://push.org/assets/website/segments/PushLogoBlack@3x.png",
      vmType: "evm",
      currency: {
        id: "pc",
        symbol: "PC",
        name: "Push Chain",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
      },
      featuredTokens: TOKENS.map((t) => ({
        id: t.address,
        symbol: t.symbol,
        name: t.name,
        address: t.address,
        decimals: t.decimals,
        logoURI: t.logoURI,
        sourceChain: t.sourceChain,
        metadata: { logoURI: t.logoURI },
      })),
    },
  ];
}

export function getTokensForChain(chain: RelayChain): RelayCurrency[] {
  return (chain.featuredTokens || []).map((t) => ({
    id: t.address,
    symbol: t.symbol,
    name: t.name,
    address: t.address,
    decimals: t.decimals,
    logoURI: t.metadata?.logoURI || t.logoURI,
    sourceChain: (t as any).sourceChain,
  }));
}
