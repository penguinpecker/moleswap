"use client";
import React from "react";
import Image from "next/image";
import { PushUniversalAccountButton } from "@pushchain/ui-kit";

export function ConnectWalletButton() {
  return (
    <div className="moleswap-wallet-btn flex items-center gap-2 px-4 py-2">
      <Image
        src="/profile/Wallet.png"
        alt="Wallet"
        width={28}
        height={28}
        className="h-7 w-7 pointer-events-none shrink-0"
      />
      <PushUniversalAccountButton />
    </div>
  );
}
