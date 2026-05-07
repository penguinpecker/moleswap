"use client";
import React, { useState, useEffect } from "react";
import { usePushWallet } from "@/lib/pushchain/provider";

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface ChainInfo {
  id: string;
  name: string;
  short: string;
  logo: string;
  hexId?: string;
}

const SUPPORTED_CHAINS: ChainInfo[] = [
  { id: "eip155:1",     name: "Ethereum",  short: "ETH",  logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",  hexId: "0x1" },
  { id: "solana",       name: "Solana",    short: "SOL",  logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  { id: "eip155:8453",  name: "Base",      short: "BASE", logo: "https://raw.githubusercontent.com/base-org/brand-kit/001c0e9b40a67799ebe0418671ac4e02a0c683ce/logo/symbol/Base_Symbol_Blue.png", hexId: "0x2105" },
  { id: "eip155:42161", name: "Arbitrum",  short: "ARB",  logo: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg", hexId: "0xa4b1" },
  { id: "eip155:56",    name: "BNB Chain", short: "BNB",  logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png", hexId: "0x38" },
  { id: "eip155:42101", name: "PushChain", short: "PC",   logo: "/push-chain-logo.png", hexId: "0xa455" },
];

function getChainByHexId(hexId: string | null): ChainInfo | undefined {
  if (!hexId) return undefined;
  return SUPPORTED_CHAINS.find((c) => c.hexId?.toLowerCase() === hexId.toLowerCase());
}

function getChainByOrigin(originChain: string | null): ChainInfo {
  if (!originChain) return SUPPORTED_CHAINS[SUPPORTED_CHAINS.length - 1];
  if (originChain.startsWith("solana:")) return SUPPORTED_CHAINS.find((c) => c.id === "solana")!;
  return SUPPORTED_CHAINS.find((c) => c.id === originChain) ?? SUPPORTED_CHAINS[SUPPORTED_CHAINS.length - 1];
}

export function ChainSelectorButton() {
  const { originChain, isConnected } = usePushWallet();
  const [liveHexChainId, setLiveHexChainId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const onChainChanged = (id: string) => setLiveHexChainId(id);
    window.ethereum.request({ method: "eth_chainId" })
      .then((id: string) => setLiveHexChainId(id))
      .catch(() => {});
    window.ethereum.on("chainChanged", onChainChanged);
    return () => window.ethereum?.removeListener("chainChanged", onChainChanged);
  }, []);

  if (!isConnected) return null;

  const chain = getChainByHexId(liveHexChainId) ?? getChainByOrigin(originChain);

  return (
    <div
      className="font-family-ThaleahFat flex items-center gap-1.5 px-3 py-3 text-lg tracking-wider text-black sm:text-xl"
      title={chain.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={chain.logo}
        alt={chain.name}
        width={20}
        height={20}
        className="h-5 w-5 rounded-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <span className="hidden sm:inline">{chain.short}</span>
    </div>
  );
}
