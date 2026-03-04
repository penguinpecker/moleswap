import { createWalletClient, createPublicClient, custom, http, type WalletClient, type PublicClient, type Chain, type Address } from "viem";
import { getWalletConnectProvider } from "./walletconnect/provider";
import { mainnet, base, arbitrum, optimism, polygon, bsc } from "viem/chains";
import { formatUnits } from "viem";
import { getAdapterForChain } from "./adapters/factory";
import type { ChainVM } from "@relayprotocol/relay-sdk";

// Chain ID to viem Chain mapping
const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  56: bsc,
  // Note: For testnets, you may need to add specific chain configs
  // 84532 would be Base Sepolia, but viem may not have it by default
};

/**
 * Gets viem Chain object for a given chain ID
 */
function getChain(chainId: number): Chain | undefined {
  return CHAIN_MAP[chainId];
}

/**
 * Creates a viem WalletClient from the available wallet provider
 * Supports MetaMask (window.ethereum) and WalletConnect
 */
export async function getWalletClient(chainId?: number): Promise<WalletClient | null> {
  if (typeof window === "undefined") return null;

  const chain = chainId ? getChain(chainId) : undefined;

  // Try MetaMask / injected provider first
  if (window.ethereum) {
    try {
      const client = createWalletClient({
        chain: chain || undefined, // Use specific chain if provided, otherwise use provider's chain
        transport: custom(window.ethereum),
      });
      return client;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Failed to create wallet client from ethereum provider", e);
    }
  }

  // Fallback to WalletConnect
  try {
    const provider = await getWalletConnectProvider();
    if (provider) {
      const client = createWalletClient({
        chain: chain || undefined,
        transport: custom(provider),
      });
      return client;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Failed to create wallet client from WalletConnect", e);
  }

  return null;
}

/**
 * Gets RPC URL for a chain ID (public RPC endpoints)
 */
function getRpcUrl(chainId: number): string | null {
  const rpcUrls: Record<number, string> = {
    1: "https://eth.llamarpc.com",
    8453: "https://base.llamarpc.com",
    42161: "https://arbitrum.llamarpc.com",
    10: "https://optimism.llamarpc.com",
    137: "https://polygon.llamarpc.com",
    56: "https://bsc.llamarpc.com",
  };
  return rpcUrls[chainId] || null;
}

/**
 * Creates a viem PublicClient from the available wallet provider
 * Supports MetaMask (window.ethereum) and WalletConnect, with HTTP fallback
 */
export async function getPublicClient(chainId?: number): Promise<PublicClient | null> {
  if (typeof window === "undefined") return null;

  const chain = chainId ? getChain(chainId) : undefined;
  if (!chain && chainId) {
    // eslint-disable-next-line no-console
    console.warn(`Chain ${chainId} not supported, using HTTP RPC`);
    const rpcUrl = getRpcUrl(chainId);
    if (rpcUrl) {
      try {
        return createPublicClient({
          transport: http(rpcUrl),
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Failed to create public client with HTTP RPC", e);
      }
    }
    return null;
  }

  // Try HTTP RPC first (most reliable for reading)
  if (chainId) {
    const rpcUrl = getRpcUrl(chainId);
    if (rpcUrl) {
      try {
        const client = createPublicClient({
          chain,
          transport: http(rpcUrl),
        });
        return client;
      } catch (e) {
        // Continue to try other methods
      }
    }
  }

  // Try MetaMask / injected provider
  if (window.ethereum) {
    try {
      const client = createPublicClient({
        chain: chain || undefined,
        transport: custom(window.ethereum),
      });
      return client;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Failed to create public client from ethereum provider", e);
    }
  }

  // Fallback to WalletConnect
  try {
    const provider = await getWalletConnectProvider();
    if (provider) {
      const client = createPublicClient({
        chain: chain || undefined,
        transport: custom(provider),
      });
      return client;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Failed to create public client from WalletConnect", e);
  }

  // Final fallback: HTTP with chain's default RPC
  if (chain) {
    try {
      const client = createPublicClient({
        chain,
        transport: http(),
      });
      return client;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Failed to create public client with HTTP transport", e);
    }
  }

  return null;
}

/**
 * ERC20 token balance ABI
 */
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
] as const;

/**
 * Fetches the balance of a token (native or ERC20) for a given address
 * Now supports all chain types via wallet adapters
 */
export async function getTokenBalance(
  address: Address | string,
  tokenAddress: Address | string,
  chainId: number,
  decimals?: number,
  vmType?: ChainVM,
): Promise<string | null> {
  try {
    // Get the appropriate wallet adapter for this chain
    const adapter = await getAdapterForChain(chainId, vmType);
    
    if (!adapter) {
      console.warn(`No wallet adapter available for chain ${chainId} (vmType: ${vmType || "unknown"})`);
      return null;
    }

    // Use the adapter to fetch balance
    const balance = await adapter.getBalance(
      chainId,
      address as string,
      tokenAddress || undefined
    );

    if (balance === undefined) {
      return null;
    }

    // Format the balance using the provided decimals or default to 18
    const tokenDecimals = decimals ?? 18;
    return formatUnits(balance, tokenDecimals);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in getTokenBalance:", error);
    return null;
  }
}

