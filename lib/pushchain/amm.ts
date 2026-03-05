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
  amountIn: string;
  fee?: number;
}): Promise<SwapQuote | null> {
  try {
    const provider = getProvider();
    const quoter = new ethers.Contract(CONTRACTS.QUOTER_V2, QUOTER_V2_ABI, provider);

    const tokenInInfo = getTokenByAddress(params.tokenIn);
    const tokenOutInfo = getTokenByAddress(params.tokenOut);
    if (!tokenInInfo || !tokenOutInfo) return null;

    // Resolve actual addresses (native PC → WPC for routing)
    const actualIn = params.tokenIn === ethers.ZeroAddress ? CONTRACTS.WPC : params.tokenIn;
    const actualOut = params.tokenOut === ethers.ZeroAddress ? CONTRACTS.WPC : params.tokenOut;

    // Find direct pool or route through WPC
    let pool = findPool(actualIn, actualOut);
    let fee = params.fee || pool?.fee || 500;

    // If no direct pool, try routing through WPC
    if (!pool && actualIn !== CONTRACTS.WPC && actualOut !== CONTRACTS.WPC) {
      // Two-hop: tokenIn → WPC → tokenOut
      // For now, use single-hop with WPC as intermediate
      const poolA = findPool(actualIn, CONTRACTS.WPC);
      const poolB = findPool(actualOut, CONTRACTS.WPC);
      if (poolA && poolB) {
        // Get quote for first leg
        const amountWei = ethers.parseUnits(params.amountIn, tokenInInfo.decimals);
        const [midAmount] = await quoter.quoteExactInputSingle.staticCall({
          tokenIn: actualIn,
          tokenOut: CONTRACTS.WPC,
          amountIn: amountWei,
          fee: poolA.fee,
          sqrtPriceLimitX96: 0,
        });
        // Get quote for second leg
        const [finalAmount,,, gasEst] = await quoter.quoteExactInputSingle.staticCall({
          tokenIn: CONTRACTS.WPC,
          tokenOut: actualOut,
          amountIn: midAmount,
          fee: poolB.fee,
          sqrtPriceLimitX96: 0,
        });

        const amountOut = ethers.formatUnits(finalAmount, tokenOutInfo.decimals);
        return {
          amountIn: params.amountIn,
          amountOut,
          tokenIn: tokenInInfo,
          tokenOut: tokenOutInfo,
          fee: poolA.fee,
          pool: poolA,
          priceImpact: 0.5, // TODO: calculate from sqrtPriceX96
          gasEstimate: gasEst?.toString() || "150000",
        };
      }
      return null;
    }

    if (!pool) return null;

    const amountWei = ethers.parseUnits(params.amountIn, tokenInInfo.decimals);
    const [amountOut,,, gasEstimate] = await quoter.quoteExactInputSingle.staticCall({
      tokenIn: actualIn,
      tokenOut: actualOut,
      amountIn: amountWei,
      fee,
      sqrtPriceLimitX96: 0,
    });

    return {
      amountIn: params.amountIn,
      amountOut: ethers.formatUnits(amountOut, tokenOutInfo.decimals),
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
  amountIn: string;
  amountOutMin: string;
  recipient: string;
  fee?: number;
  deadline?: number;
}): Promise<{ txHash: string; success: boolean }> {
  try {
    const tokenInInfo = getTokenByAddress(params.tokenIn);
    if (!tokenInInfo) throw new Error("Unknown input token");

    const actualIn = params.tokenIn === ethers.ZeroAddress ? CONTRACTS.WPC : params.tokenIn;
    const actualOut = params.tokenOut === ethers.ZeroAddress ? CONTRACTS.WPC : params.tokenOut;
    const pool = findPool(actualIn, actualOut);
    const fee = params.fee || pool?.fee || 500;

    const amountIn = ethers.parseUnits(params.amountIn, tokenInInfo.decimals);
    const amountOutMin = ethers.parseUnits(params.amountOutMin, getTokenByAddress(params.tokenOut)?.decimals || 18);
    const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1800; // 30 min

    const iface = new ethers.Interface(SWAP_ROUTER_ABI);
    const swapData = iface.encodeFunctionData("exactInputSingle", [{
      tokenIn: actualIn,
      tokenOut: actualOut,
      fee,
      recipient: params.recipient,
      amountIn,
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0,
    }]);

    // Use PushChain universal transaction
    if (params.pushChainClient?.universal?.sendTransaction) {
      const txHash = await params.pushChainClient.universal.sendTransaction({
        to: CONTRACTS.SWAP_ROUTER,
        value: params.tokenIn === ethers.ZeroAddress ? amountIn : BigInt(0),
        data: swapData,
      });
      return { txHash: txHash || "", success: true };
    }

    // Fallback: direct EVM call
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: CONTRACTS.SWAP_ROUTER,
        value: params.tokenIn === ethers.ZeroAddress ? amountIn : BigInt(0),
        data: swapData,
      });
      const receipt = await tx.wait();
      return { txHash: receipt?.hash || tx.hash, success: true };
    }

    throw new Error("No wallet available");
  } catch (err) {
    console.error("Swap error:", err);
    return { txHash: "", success: false };
  }
}

// ═══ TOKEN APPROVAL ═══
export async function approveToken(
  tokenAddress: string,
  amount: string,
  decimals: number = 18
): Promise<string | null> {
  try {
    if (typeof window === "undefined" || !(window as any).ethereum) return null;
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const amountWei = ethers.parseUnits(amount, decimals);
    const tx = await token.approve(CONTRACTS.SWAP_ROUTER, amountWei);
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
