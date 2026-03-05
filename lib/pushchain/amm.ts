/**
 * PushChain AMM — Uniswap V3-style Concentrated Liquidity
 * Interacts with deployed contracts on Push Chain Donut Testnet
 */
import { ethers } from "ethers";
import {
  CONTRACTS, TOKENS, POOLS, PUSHCHAIN_RPC, PUSHCHAIN_CHAIN_ID,
  QUOTER_V2_ABI, SWAP_ROUTER_ABI, ERC20_ABI, POOL_ABI,
  getTokenByAddress, findPool,
  type TokenInfo, type PoolInfo,
} from "./contracts";

// Re-export everything the app needs
export {
  CONTRACTS, TOKENS, POOLS, PUSHCHAIN_RPC, PUSHCHAIN_CHAIN_ID,
  getTokenByAddress, findPool,
  type TokenInfo, type PoolInfo,
};

// Legacy exports for backward compat
export const AMM_ROUTER = CONTRACTS.SWAP_ROUTER;
export const AMM_FACTORY = CONTRACTS.FACTORY;
export type PushChainToken = TokenInfo;
export type Pool = PoolInfo;

export const PUSHCHAIN_TOKENS = TOKENS;

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  fee: number;
  pool: PoolInfo;
  priceImpact: number;
  gasEstimate: string;
}

// ═══ PROVIDER ═══
export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(PUSHCHAIN_RPC);
}

// ═══ QUOTE ═══
export async function getSwapQuote(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string; // WEI format (raw BigInt string)
  fee?: number;
}): Promise<SwapQuote | null> {
  try {
    const provider = getProvider();
    const quoter = new ethers.Contract(CONTRACTS.QUOTER_V2, QUOTER_V2_ABI, provider);

    const tokenInInfo = getTokenByAddress(params.tokenIn);
    const tokenOutInfo = getTokenByAddress(params.tokenOut);
    if (!tokenInInfo || !tokenOutInfo) return null;

    // amountIn is already in WEI from ExchangePage
    const amountInWei = BigInt(params.amountIn || "0");
    if (amountInWei === 0n) return null;

    // Resolve actual addresses (native PC → WPC for routing)
    const actualIn = params.tokenIn === ethers.ZeroAddress ? CONTRACTS.WPC : params.tokenIn;
    const actualOut = params.tokenOut === ethers.ZeroAddress ? CONTRACTS.WPC : params.tokenOut;

    // Find direct pool or route through WPC
    let pool = findPool(actualIn, actualOut);
    let fee = params.fee || pool?.fee || 500;

    // If no direct pool, try routing through WPC
    if (!pool && actualIn !== CONTRACTS.WPC && actualOut !== CONTRACTS.WPC) {
      const poolA = findPool(actualIn, CONTRACTS.WPC);
      const poolB = findPool(actualOut, CONTRACTS.WPC);
      if (poolA && poolB) {
        const [midAmount] = await quoter.quoteExactInputSingle.staticCall({
          tokenIn: actualIn,
          tokenOut: CONTRACTS.WPC,
          amountIn: amountInWei,
          fee: poolA.fee,
          sqrtPriceLimitX96: 0,
        });
        const [finalAmount,,, gasEst] = await quoter.quoteExactInputSingle.staticCall({
          tokenIn: CONTRACTS.WPC,
          tokenOut: actualOut,
          amountIn: midAmount,
          fee: poolB.fee,
          sqrtPriceLimitX96: 0,
        });

        return {
          amountIn: params.amountIn,
          amountOut: finalAmount.toString(), // Return WEI
          tokenIn: tokenInInfo,
          tokenOut: tokenOutInfo,
          fee: poolA.fee,
          pool: poolA,
          priceImpact: 0.5,
          gasEstimate: gasEst?.toString() || "150000",
        };
      }
      return null;
    }

    if (!pool) return null;

    const [amountOut,,, gasEstimate] = await quoter.quoteExactInputSingle.staticCall({
      tokenIn: actualIn,
      tokenOut: actualOut,
      amountIn: amountInWei,
      fee,
      sqrtPriceLimitX96: 0,
    });

    return {
      amountIn: params.amountIn,
      amountOut: amountOut.toString(), // Return WEI
      tokenIn: tokenInInfo,
      tokenOut: tokenOutInfo,
      fee,
      pool,
      priceImpact: 0.3,
      gasEstimate: gasEstimate?.toString() || "150000",
    };
  } catch (err) {
    console.error("Quote error:", err);
    return null;
  }
}

// ═══ EXECUTE SWAP ═══
export async function executeSwap(params: {
  pushChainClient: any;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;    // WEI format
  amountOutMin: string; // WEI format
  recipient: string;
  fee?: number;
  deadline?: number;
}): Promise<{ txHash: string; success: boolean }> {
  try {
    const actualIn = params.tokenIn === ethers.ZeroAddress ? CONTRACTS.WPC : params.tokenIn;
    const actualOut = params.tokenOut === ethers.ZeroAddress ? CONTRACTS.WPC : params.tokenOut;
    const pool = findPool(actualIn, actualOut);
    const fee = params.fee || pool?.fee || 500;

    const amountIn = BigInt(params.amountIn);
    // Apply 1% slippage to amountOutMin
    const amountOutMin = BigInt(params.amountOutMin) * 99n / 100n;
    const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1800;

    const iface = new ethers.Interface(SWAP_ROUTER_ABI);
    const swapCalldata = iface.encodeFunctionData("exactInputSingle", [{
      tokenIn: actualIn,
      tokenOut: actualOut,
      fee,
      recipient: params.recipient,
      amountIn,
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0,
    }]);

    const isNativeIn = params.tokenIn === ethers.ZeroAddress;
    const txValue = isNativeIn ? amountIn : BigInt(0);

    // 1. If not native, approve token first
    if (!isNativeIn) {
      try {
        const approveHash = await approveToken(params.tokenIn, params.amountIn);
        if (approveHash) console.log("Approved:", approveHash);
      } catch (e) {
        console.warn("Approve may have failed, trying swap anyway:", e);
      }
    }

    // 2. Execute via PushChain universal transaction
    if (params.pushChainClient?.universal?.sendTransaction) {
      const txHash = await params.pushChainClient.universal.sendTransaction({
        to: CONTRACTS.SWAP_ROUTER,
        value: txValue,
        data: swapCalldata,
      });
      return { txHash: txHash || "", success: true };
    }

    // 3. Fallback: direct EVM call via browser wallet
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: CONTRACTS.SWAP_ROUTER,
        value: txValue,
        data: swapCalldata,
      });
      const receipt = await tx.wait();
      return { txHash: receipt?.hash || tx.hash, success: true };
    }

    throw new Error("No wallet available for swap execution");
  } catch (err: any) {
    console.error("Swap error:", err);
    return { txHash: "", success: false };
  }
}

// ═══ TOKEN APPROVAL ═══
export async function approveToken(
  tokenAddress: string,
  amountWei: string, // WEI format
): Promise<string | null> {
  try {
    if (typeof window === "undefined" || !(window as any).ethereum) return null;
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const tx = await token.approve(CONTRACTS.SWAP_ROUTER, BigInt(amountWei));
    const receipt = await tx.wait();
    return receipt?.hash || tx.hash;
  } catch (err) {
    console.error("Approve error:", err);
    return null;
  }
}

// ═══ GET ALL POOLS WITH LIQUIDITY ═══
export async function getAllPools(userAddress?: string): Promise<any[]> {
  try {
    const provider = getProvider();
    const poolData = await Promise.all(
      POOLS.map(async (pool) => {
        try {
          const contract = new ethers.Contract(pool.address, POOL_ABI, provider);
          const [slot0, liquidity] = await Promise.all([
            contract.slot0(),
            contract.liquidity(),
          ]);
          const token0 = getTokenByAddress(pool.token0);
          const token1 = getTokenByAddress(pool.token1);
          return {
            ...pool,
            token0Info: token0,
            token1Info: token1,
            sqrtPriceX96: slot0[0].toString(),
            tick: slot0[1],
            liquidity: liquidity.toString(),
            hasLiquidity: liquidity > 0n,
          };
        } catch {
          return { ...pool, hasLiquidity: false, liquidity: "0" };
        }
      })
    );
    return poolData.filter((p: any) => p.hasLiquidity);
  } catch (err) {
    console.error("Get pools error:", err);
    return [];
  }
}

// ═══ ADD/REMOVE LIQUIDITY (stubs) ═══
export async function addLiquidity(params: any) {
  console.log("Add liquidity via PositionManager:", CONTRACTS.POSITION_MANAGER);
  return { txHash: "", success: false };
}

export async function removeLiquidity(params: any) {
  console.log("Remove liquidity via PositionManager:", CONTRACTS.POSITION_MANAGER);
  return { txHash: "", success: false };
}

export async function getPairReserves(tokenA: string, tokenB: string) {
  return { reserve0: "0", reserve1: "0" };
}
