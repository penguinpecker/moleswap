"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

/**
 * PushChain Wallet Context
 * 
 * Wraps @pushchain/ui-kit's PushUniversalWalletProvider.
 * When the SDK is installed, uncomment the imports below and remove the mock.
 * 
 * import { PushUniversalWalletProvider, usePushWalletContext, usePushChainClient } from '@pushchain/ui-kit';
 * import { PushChain } from '@pushchain/core';
 */

export interface PushWalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  balance: string | null;
  pushChainClient: any | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  getBalance: (tokenAddress?: string) => Promise<string | null>;
  sendTransaction: (params: { to: string; value: bigint; data?: string }) => Promise<string | null>;
}

const PushWalletContext = createContext<PushWalletState>({
  address: null,
  isConnected: false,
  isConnecting: false,
  chainId: null,
  balance: null,
  pushChainClient: null,
  connect: async () => {},
  disconnect: () => {},
  getBalance: async () => null,
  sendTransaction: async () => null,
});

export const usePushWallet = () => useContext(PushWalletContext);

interface Props {
  children: React.ReactNode;
  network?: "testnet" | "mainnet";
}

export function PushChainWalletProvider({ children, network = "testnet" }: Props) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [pushChainClient, setPushChainClient] = useState<any>(null);

  const isConnected = !!address;

  /**
   * Connect wallet using PushChain Universal Wallet
   * 
   * When @pushchain/core is installed:
   * 1. Use ethers.Wallet.createRandom() or browser wallet signer
   * 2. Convert to PushChain.utils.signer.toUniversal(signer) 
   * 3. Initialize PushChain.initialize(universalSigner, { network })
   * 4. The user gets a universal address that works on any chain
   */
  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      // --- PushChain SDK integration ---
      // Uncomment when @pushchain/core is installed:
      //
      // const { PushChain } = await import('@pushchain/core');
      // const { ethers } = await import('ethers');
      //
      // // If browser wallet (MetaMask etc.) is available, use it
      // let signer;
      // if (typeof window !== 'undefined' && window.ethereum) {
      //   const provider = new ethers.BrowserProvider(window.ethereum);
      //   signer = await provider.getSigner();
      // } else {
      //   // Generate a new wallet for walletless onboarding
      //   signer = ethers.Wallet.createRandom();
      // }
      //
      // const universalSigner = await PushChain.utils.signer.toUniversal(signer);
      // const client = await PushChain.initialize(universalSigner, {
      //   network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
      // });
      //
      // const addr = await signer.getAddress();
      // setAddress(addr);
      // setPushChainClient(client);
      // setChainId(1); // PushChain universal

      // --- Temporary: connect via injected wallet (MetaMask/etc.) ---
      if (typeof window !== "undefined" && window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        if (accounts[0]) {
          setAddress(accounts[0]);
          const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
          setChainId(parseInt(chainIdHex, 16));
        }
      } else {
        console.warn("No wallet provider found. Install MetaMask or wait for PushChain UI Kit.");
      }
    } catch (err) {
      console.error("Failed to connect wallet:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [network]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setBalance(null);
    setPushChainClient(null);
  }, []);

  const getBalance = useCallback(async (tokenAddress?: string): Promise<string | null> => {
    if (!address) return null;
    try {
      // PushChain SDK balance check would go here
      // For now, use standard EVM balance
      if (typeof window !== "undefined" && window.ethereum) {
        const bal = await window.ethereum.request({
          method: "eth_getBalance",
          params: [address, "latest"],
        });
        const formatted = (parseInt(bal, 16) / 1e18).toFixed(6);
        setBalance(formatted);
        return formatted;
      }
    } catch (err) {
      console.error("Balance fetch error:", err);
    }
    return null;
  }, [address]);

  const sendTransaction = useCallback(async (params: {
    to: string; value: bigint; data?: string;
  }): Promise<string | null> => {
    if (!address) return null;
    try {
      // --- PushChain universal transaction ---
      // if (pushChainClient) {
      //   const txHash = await pushChainClient.universal.sendTransaction({
      //     to: params.to,
      //     value: params.value,
      //     data: params.data,
      //   });
      //   return txHash;
      // }

      // Fallback: standard EVM transaction
      if (typeof window !== "undefined" && window.ethereum) {
        const txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [{
            from: address,
            to: params.to,
            value: "0x" + params.value.toString(16),
            data: params.data || "0x",
          }],
        });
        return txHash;
      }
    } catch (err) {
      console.error("Transaction error:", err);
    }
    return null;
  }, [address, pushChainClient]);

  // Auto-reconnect if wallet was previously connected
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
        if (accounts[0]) {
          setAddress(accounts[0]);
          window.ethereum.request({ method: "eth_chainId" }).then((hex: string) => {
            setChainId(parseInt(hex, 16));
          });
        }
      }).catch(() => {});

      // Listen for account/chain changes
      const handleAccountsChanged = (accounts: string[]) => {
        setAddress(accounts[0] || null);
      };
      const handleChainChanged = (hex: string) => {
        setChainId(parseInt(hex, 16));
      };
      window.ethereum.on?.("accountsChanged", handleAccountsChanged);
      window.ethereum.on?.("chainChanged", handleChainChanged);
      return () => {
        window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener?.("chainChanged", handleChainChanged);
      };
    }
  }, []);

  return (
    <PushWalletContext.Provider value={{
      address, isConnected, isConnecting, chainId, balance,
      pushChainClient, connect, disconnect, getBalance, sendTransaction,
    }}>
      {children}
    </PushWalletContext.Provider>
  );
}
