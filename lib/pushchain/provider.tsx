"use client";
import React, { createContext, useContext } from "react";
import {
  PushUniversalWalletProvider,
  PushUniversalAccountButton,
  usePushWalletContext,
  usePushChainClient,
  PushUI,
} from "@pushchain/ui-kit";

// Re-export the official components
export { PushUniversalAccountButton, usePushWalletContext, usePushChainClient, PushUI };

// Convenience hook that wraps the official hooks
export function usePushWallet() {
  const walletCtx = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();

  const isConnected = walletCtx?.connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const address = pushChainClient?.universal?.account || null;

  return {
    address,
    isConnected,
    isConnecting: walletCtx?.connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTING,
    connectionStatus: walletCtx?.connectionStatus,
    pushChainClient,
    // For backward compat with code that calls connect()
    connect: () => {
      // The PushUniversalAccountButton handles connection UI
      // This is a no-op - connection is handled by the button component
      console.log("Use <PushUniversalAccountButton /> for wallet connection");
    },
    disconnect: () => {
      walletCtx?.handleLogout?.();
    },
  };
}

interface Props {
  children: React.ReactNode;
  network?: "testnet" | "mainnet";
}

export function PushChainWalletProvider({ children, network = "testnet" }: Props) {
  const walletConfig = {
    network: network === "mainnet"
      ? PushUI.CONSTANTS.PUSH_NETWORK.MAINNET
      : PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
    login: {
      email: true,
      google: true,
      wallet: { enabled: true },
    },
  };

  return (
    <PushUniversalWalletProvider config={walletConfig}>
      {children}
    </PushUniversalWalletProvider>
  );
}
