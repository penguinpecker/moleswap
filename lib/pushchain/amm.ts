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
}): Promise<{ txHash: string; success: boolean; error?: string }> {
  try {
    const isNativeIn = params.tokenIn === ethers.ZeroAddress;
    const actualIn = isNativeIn ? CONTRACTS.WPC : params.tokenIn;
    const actualOut = params.tokenOut === ethers.ZeroAddress ? CONTRACTS.WPC : params.tokenOut;
    const pool = findPool(actualIn, actualOut);
    const fee = params.fee || pool?.fee || 500;

    const amountIn = BigInt(params.amountIn);
    const amountOutMin = BigInt(params.amountOutMin) * 95n / 100n; // 5% slippage
    const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1800;

    console.log("[MoleSwap] executeSwap:", {
      isNativeIn,
      tokenIn: actualIn.slice(0,10),
      tokenOut: actualOut.slice(0,10),
      amountIn: amountIn.toString(),
      fee,
    });

    // For native PC swaps, we need to:
    // 1. Wrap PC → WPC
    // 2. Approve WPC for Router
    // 3. Swap WPC → target token

    // ═══ STEP 1: Wrap native PC → WPC (if native input) ═══
    if (isNativeIn) {
      console.log("[MoleSwap] Step 1: Wrapping PC → WPC...");
      const wpcIface = new ethers.Interface(["function deposit() payable"]);
      const wrapData = wpcIface.encodeFunctionData("deposit");

      if (params.pushChainClient?.universal?.sendTransaction) {
        const wrapTx = await params.pushChainClient.universal.sendTransaction({
          to: CONTRACTS.WPC,
          value: amountIn,
          data: wrapData,
        });
        console.log("[MoleSwap] Wrap tx:", wrapTx);
        // Wait a moment for wrap to confirm
        await new Promise(r => setTimeout(r, 3000));
      } else if (typeof window !== "undefined" && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const tx = await signer.sendTransaction({
          to: CONTRACTS.WPC,
          value: amountIn,
          data: wrapData,
        });
        await tx.wait();
        console.log("[MoleSwap] Wrap confirmed:", tx.hash);
      } else {
        throw new Error("No wallet available for wrapping");
      }
    }

    // ═══ STEP 2: Approve token for Router ═══
    console.log("[MoleSwap] Step 2: Approving token for Router...");
    const tokenToApprove = isNativeIn ? CONTRACTS.WPC : params.tokenIn;
    
    if (params.pushChainClient?.universal?.sendTransaction) {
      const approveIface = new ethers.Interface(["function approve(address spender, uint256 amount) returns (bool)"]);
      const MAX_UINT = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
      const approveData = approveIface.encodeFunctionData("approve", [CONTRACTS.SWAP_ROUTER, MAX_UINT]);
      
      const approveTx = await params.pushChainClient.universal.sendTransaction({
        to: tokenToApprove,
        value: BigInt(0),
        data: approveData,
      });
      console.log("[MoleSwap] Approve tx:", approveTx);
      await new Promise(r => setTimeout(r, 3000));
    } else if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(tokenToApprove, ERC20_ABI, signer);
      const MAX_UINT = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
      const tx = await token.approve(CONTRACTS.SWAP_ROUTER, MAX_UINT);
      await tx.wait();
      console.log("[MoleSwap] Approve confirmed:", tx.hash);
    }

    // ═══ STEP 3: Execute swap (NO native value — we already wrapped) ═══
    console.log("[MoleSwap] Step 3: Executing swap...");
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

    let txHash = "";

    if (params.pushChainClient?.universal?.sendTransaction) {
      txHash = await params.pushChainClient.universal.sendTransaction({
        to: CONTRACTS.SWAP_ROUTER,
        value: BigInt(0), // NOT sending native — tokens are already wrapped
        data: swapCalldata,
      });
      console.log("[MoleSwap] Swap tx:", txHash);
    } else if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: CONTRACTS.SWAP_ROUTER,
        value: BigInt(0),
        data: swapCalldata,
      });
      const receipt = await tx.wait();
      txHash = receipt?.hash || tx.hash;
      console.log("[MoleSwap] Swap confirmed:", txHash);
    } else {
      throw new Error("No wallet available for swap execution");
    }

    if (!txHash) {
      throw new Error("Swap transaction returned empty hash");
    }

    return { txHash, success: true };
  } catch (err: any) {
    console.error("[MoleSwap] Swap error:", err?.message || err);
    return { txHash: "", success: false, error: err?.message || "Unknown swap error" };
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
