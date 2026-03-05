"use client";
import React from "react";
import {
  PushUniversalWalletProvider,
  usePushWalletContext,
  usePushChainClient,
  PushUI,
} from "@pushchain/ui-kit";

// Re-export hooks for convenience
export { usePushWalletContext, usePushChainClient, PushUI };

// Convenience hook wrapping the official hooks
export function usePushWallet() {
  const walletCtx = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();

  const isConnected = walletCtx?.connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const address = walletCtx?.universalAccount?.address || pushChainClient?.universal?.account || null;

  return {
    address,
    isConnected,
    isConnecting:
      walletCtx?.connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTING ||
      walletCtx?.connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.AUTHENTICATING,
    connectionStatus: walletCtx?.connectionStatus,
    pushChainClient,
    universalAccount: walletCtx?.universalAccount,
    connect: () => walletCtx?.handleConnectToPushWallet?.(),
    disconnect: () => walletCtx?.handleUserLogOutEvent?.(),
  };
}

interface Props {
  children: React.ReactNode;
  network?: "testnet" | "mainnet";
}

export function PushChainWalletProvider({ children, network = "testnet" }: Props) {
  const walletConfig = {
    network:
      network === "mainnet"
        ? PushUI.CONSTANTS.PUSH_NETWORK.MAINNET
        : PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
  };

  return (
    <PushUniversalWalletProvider config={walletConfig}>
      {children}
    </PushUniversalWalletProvider>
  );
}
