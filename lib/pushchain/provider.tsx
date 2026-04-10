"use client";
import React from "react";
import {
  PushUniversalWalletProvider,
  usePushWalletContext,
  usePushChainClient,
  PushUI,
} from "@pushchain/ui-kit";

export { usePushWalletContext, usePushChainClient, PushUI };

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
    originChain: walletCtx?.universalAccount?.chain || null,
    connect: () => walletCtx?.handleConnectToPushWallet?.(),
    disconnect: () => walletCtx?.handleUserLogOutEvent?.(),
  };
}

interface Props {
  children: React.ReactNode;
  network?: "testnet" | "mainnet";
}

const APP_METADATA = {
  logoUrl: "/moleswap-logo.png",
  title: "MoleSwap",
  description: "Pixel-art DEX on PushChain. Swap, earn XP, climb the leaderboard.",
};

export function PushChainWalletProvider({ children, network = "testnet" }: Props) {
  const walletConfig = {
    network:
      network === "mainnet"
        ? PushUI.CONSTANTS.PUSH_NETWORK.MAINNET
        : PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
    login: {
      email: true,
      google: true,
      wallet: {
        enabled: true,
      },
      appPreview: true,
    },
    modal: {
      loginLayout: PushUI.CONSTANTS.LOGIN.LAYOUT.SPLIT,
      connectedLayout: PushUI.CONSTANTS.CONNECTED.LAYOUT.HOVER,
      appPreview: true,
    },
  };

  return (
    <PushUniversalWalletProvider config={walletConfig} app={APP_METADATA}>
      {children}
    </PushUniversalWalletProvider>
  );
}
