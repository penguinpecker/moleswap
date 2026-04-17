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

  // CRITICAL: For Solana-origin wallets (Phantom), `universalAccount.address`
  // is the Solana pubkey — useless for EVM operations on PushChain. The UEA
  // (`pushChainClient.universal.account`) is the EVM address on PushChain that
  // actually holds balances and is addressable by contracts. Always prefer the
  // UEA for on-chain operations, fall back to universalAccount only when the
  // UEA isn't ready yet AND the origin is EVM (address is already EVM-compatible).
  const uea: string | null =
    (pushChainClient as any)?.universal?.account || null;
  const origin: string | null =
    walletCtx?.universalAccount?.address ||
    (pushChainClient as any)?.universal?.origin ||
    null;
  const originChainRaw: string | null =
    walletCtx?.universalAccount?.chain || null;
  const isEvmOrigin = !originChainRaw ||
    originChainRaw.toLowerCase().startsWith("eip155");

  // `address` is what gets used for on-chain reads (balance, allowance) and as
  // `recipient` in swap txs. It MUST be a valid EVM hex address. If we have the
  // UEA, use it — always valid. Otherwise fall back to origin ONLY if origin is
  // itself an EVM hex address (0x...). A Solana pubkey (base58) is NEVER a
  // valid EVM address, so we return null rather than letting it leak into
  // eth_getBalance calls which will reject it.
  //
  // Without this guard: during the brief window between wallet connect and UEA
  // resolution, the Phantom/Solana pubkey would slip through via the
  // isEvmOrigin fallback (because originChainRaw is momentarily null), and
  // balance-fetch effects would POST the Solana pubkey to eth_getBalance,
  // producing the "invalid argument 0: json: cannot unmarshal hex string
  // without 0x prefix" RPC error seen in prod logs.
  const looksLikeEvmHex = (s: string | null): boolean =>
    !!s && s.startsWith("0x") && s.length === 42;
  const address =
    uea ||
    (isEvmOrigin && looksLikeEvmHex(origin) ? origin : null);

  return {
    address,           // UEA — use this for on-chain operations
    uea,               // UEA explicit (may be null before first tx)
    origin,            // origin wallet address (Solana pubkey for Phantom)
    isConnected,
    isConnecting:
      walletCtx?.connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTING ||
      walletCtx?.connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.AUTHENTICATING,
    connectionStatus: walletCtx?.connectionStatus,
    pushChainClient,
    universalAccount: walletCtx?.universalAccount,
    originChain: originChainRaw,
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
