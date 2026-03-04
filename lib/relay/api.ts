export const RELAY_API = "https://api.testnets.relay.link";

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
  vmType?: "evm" | "svm" | "bvm" | "tvm" | "suivm" | "hypevm";
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
  const res = await fetch(`${RELAY_API}/chains`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Relay getChains failed: ${res.status}`);
  const data = await res.json();
  return (data?.chains || []) as RelayChain[];
}

export function getTokensForChain(chain: RelayChain): RelayCurrency[] {
  const featured = chain.featuredTokens ?? [];
  const erc20 = chain.erc20Currencies ?? [];
  const nativeAddress = chain.currency?.address || "0x0000000000000000000000000000000000000000";
  const native: RelayCurrency | null = chain.currency
    ? {
        id: chain.currency.id || nativeAddress,
        symbol: chain.currency.symbol,
        name: chain.currency.name,
        address: nativeAddress,
        decimals: chain.currency.decimals,
        logoURI: chain.logoUrl || chain.iconUrl,
      }
    : null;
  // Deduplicate by address/id
  const seen = new Set<string>();
  const result: RelayCurrency[] = [];
  if (native) {
    const key = (native.address || native.id).toLowerCase();
    seen.add(key);
    result.push(native);
  }
  for (const t of [...featured, ...erc20]) {
    const key = (t.address || t.id).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      const logoURI = (t as any)?.metadata?.logoURI as string | undefined;
      result.push({ id: t.id, symbol: t.symbol, name: t.name, address: t.address, decimals: t.decimals, logoURI });
    }
  }
  return result;
}
