"use client";
import React, { useCallback, useState, useEffect } from "react";
import { usePushWallet } from "@/lib/pushchain/provider";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  Wallet,
  RefreshCw,
  Copy,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { getChains, type RelayChain } from "@/lib/relay/api";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function ConnectWalletButton() {
  const { address, isConnected, isConnecting, chainId, connect, disconnect } = usePushWallet();
  const [chains, setChains] = useState<RelayChain[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const label = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Connect Wallet";

  useEffect(() => {
    getChains().then(setChains).catch(console.error);
  }, []);

  const currentChainName = chains.find((c) => c.id === chainId)?.displayName || chainId ? `Chain ${chainId}` : "";

  const copyAddress = useCallback(async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address]);

  const handleConnect = useCallback(async () => {
    if (isConnected) return;
    await connect();
  }, [isConnected, connect]);

  const switchChain = useCallback(async (targetChainId: number) => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        });
      } catch (err: any) {
        console.error("Chain switch failed:", err);
      }
    }
  }, []);

  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="font-family-ThaleahFat flex cursor-pointer items-center gap-2 px-6 py-3 text-xl tracking-wider text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
      >
        <Image
          src="/profile/Wallet.png"
          alt="Wallet"
          width={24}
          height={24}
          className="h-6 w-6"
        />
        {isConnecting ? "CONNECTING..." : "CONNECT WALLET"}
      </button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="font-family-ThaleahFat flex cursor-pointer items-center gap-2 px-4 py-3 text-xl tracking-wider text-black transition-all hover:scale-[1.02]">
          <Image
            src="/profile/Wallet.png"
            alt="Wallet"
            width={24}
            height={24}
            className="h-6 w-6"
          />
          <span>{label}</span>
          {currentChainName && (
            <span className="rounded bg-black/10 px-2 py-0.5 text-sm">
              {currentChainName}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="bg-ground w-72 border-2 border-[#523525] p-2"
      >
        <DropdownMenuLabel className="font-family-ThaleahFat text-peach-300 text-lg">
          Wallet
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[#523525]" />

        {/* Copy address */}
        <DropdownMenuItem
          onClick={copyAddress}
          className="font-family-ThaleahFat text-peach-300 cursor-pointer gap-2 text-base hover:bg-[#523525]"
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copied!" : label}
        </DropdownMenuItem>

        {/* Switch chain */}
        {chains.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-[#523525]" />
            <DropdownMenuLabel className="font-family-ThaleahFat text-peach-300/60 text-sm">
              Switch Network
            </DropdownMenuLabel>
            <div className="max-h-48 overflow-y-auto">
              {chains.slice(0, 8).map((chain) => (
                <DropdownMenuItem
                  key={chain.id}
                  onClick={() => switchChain(chain.id)}
                  className={`font-family-ThaleahFat cursor-pointer gap-2 text-base hover:bg-[#523525] ${
                    chain.id === chainId ? "text-peach-400" : "text-peach-300"
                  }`}
                >
                  {chain.iconUrl && (
                    <img src={chain.iconUrl} alt="" className="h-5 w-5 rounded" />
                  )}
                  {chain.displayName}
                  {chain.id === chainId && <ChevronRight className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </div>
          </>
        )}

        <DropdownMenuSeparator className="bg-[#523525]" />

        {/* Disconnect */}
        <DropdownMenuItem
          onClick={disconnect}
          className="font-family-ThaleahFat cursor-pointer gap-2 text-base text-red-400 hover:bg-[#523525]"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
