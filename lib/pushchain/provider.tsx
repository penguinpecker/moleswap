"use client";
import React from "react";
import {
  PushUniversalWalletProvider,
  usePushWalletContext,
  usePushChainClient,
  PushUI,
} from "@pushchain/ui-kit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "./wagmi-config";

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
  logoUrl: "https://www.moleswap.com/moleswap-logo.png",
  title: "MoleSwap",
  description: "Pixel-art DEX on PushChain. Swap, earn XP, climb the leaderboard.",
};

// Single QueryClient instance — created once, outside the component render,
// so React Query's cache persists across re-renders of the provider.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function PushChainWalletProvider({ children, network = "testnet" }: Props) {
  const walletConfig = {
    network:
      network === "mainnet"
        ? PushUI.CONSTANTS.PUSH_NETWORK.MAINNET
        : PushUI.CONSTANTS.PUSH_NETWORK.TESTNET_DONUT,
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

  // Provider nesting mirrors RamenFi's production setup:
  //   WagmiProvider > QueryClientProvider > PushUniversalWalletProvider
  // WagmiProvider must be outermost so its EIP-6963 discovery fires before
  // the ui-kit's MetaMaskSDK calls sdk.getProvider() — that's what makes
  // MetaMask (and Rabby / Zerion) appear in the wallet modal.
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <PushUniversalWalletProvider config={walletConfig} app={APP_METADATA}>
          {children}
        </PushUniversalWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
