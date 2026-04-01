/**
 * PushChain AMM — Uniswap V3-style Concentrated Liquidity
 * Interacts with deployed contracts on Push Chain Donut Testnet
 */
import { ethers } from "ethers";
import {
  CONTRACTS, TOKENS, POOLS, PUSHCHAIN_RPC, PUSHCHAIN_CHAIN_ID,
  QUOTER_V2_ABI, SWAP_ROUTER_ABI, ERC20_ABI, POOL_ABI,
  POSITION_MANAGER_ABI, WPC_ABI, TICK_SPACINGS, MIN_TICK, MAX_TICK,
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

    // ═══ Handle PC ↔ WPC as 1:1 wrap/unwrap (no router quote needed) ═══
    const isWrapOrUnwrap = actualIn.toLowerCase() === actualOut.toLowerCase();
    if (isWrapOrUnwrap) {
      return {
        amountIn: params.amountIn,
        amountOut: params.amountIn, // 1:1
        tokenIn: tokenInInfo,
        tokenOut: tokenOutInfo,
        fee: 0,
        pool: { address: CONTRACTS.WPC, token0: params.tokenIn, token1: params.tokenOut, fee: 0, name: "WRAP" } as any,
        priceImpact: 0,
        gasEstimate: "50000",
      };
    }

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

// ═══ HELPER: Extract tx hash from PushChain wallet response ═══
// PushChain sendTransaction may return various shapes — search deeply
function extractHash(result: any): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  
  // Direct property checks (common names)
  const directKeys = [
    "hash", "txHash", "txnHash", "transactionHash", "transactionhash",
    "tx_hash", "txn_hash", "transaction_hash",
  ];
  for (const key of directKeys) {
    if (result[key] && typeof result[key] === "string") return result[key];
  }
  
  // Nested checks
  if (result.tx?.hash) return result.tx.hash;
  if (result.receipt?.transactionHash) return result.receipt.transactionHash;
  if (result.receipt?.hash) return result.receipt.hash;
  if (result.response?.hash) return result.response.hash;
  if (result.data?.hash) return result.data.hash;
  if (result.data?.txHash) return result.data.txHash;
  
  // Search all values for a hex string that looks like a tx hash (0x + 64 hex chars)
  const hashRegex = /^0x[a-fA-F0-9]{64}$/;
  for (const val of Object.values(result)) {
    if (typeof val === "string" && hashRegex.test(val)) return val;
  }
  
  // Deep search one level
  for (const val of Object.values(result)) {
    if (val && typeof val === "object") {
      for (const inner of Object.values(val as any)) {
        if (typeof inner === "string" && hashRegex.test(inner)) return inner;
      }
    }
  }
  
  // Last resort — stringify so we don't lose it
  console.warn("[MoleSwap] Could not extract hash from:", JSON.stringify(result).slice(0, 200));
  return "";
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
  onStep?: (step: number, label: string, status: "pending" | "signing" | "confirmed" | "error") => void;
}): Promise<{ txHash: string; success: boolean; error?: string }> {
  const onStep = params.onStep || (() => {});
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

    // ═══ DETECT WRAP/UNWRAP (PC ↔ WPC) — no router needed ═══
    const isWrap = isNativeIn && actualOut.toLowerCase() === CONTRACTS.WPC.toLowerCase();
    const isUnwrap = actualIn.toLowerCase() === CONTRACTS.WPC.toLowerCase() && params.tokenOut === ethers.ZeroAddress;
    
    if (isWrap) {
      // Pure wrap: PC → WPC via deposit()
      onStep(0, "WRAP PC → WPC", "signing");
      console.log("[MoleSwap] Pure wrap operation: PC → WPC");
      const wpcIface = new ethers.Interface(["function deposit() payable"]);
      const wrapData = wpcIface.encodeFunctionData("deposit");
      let txHash = "";

      if (params.pushChainClient?.universal?.sendTransaction) {
        const wrapResult = await params.pushChainClient.universal.sendTransaction({
          to: CONTRACTS.WPC, value: amountIn, data: wrapData,
        });
        txHash = extractHash(wrapResult);
        console.log("[MoleSwap] Wrap tx:", wrapResult, "hash:", txHash);
      } else if (typeof window !== "undefined" && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const tx = await signer.sendTransaction({ to: CONTRACTS.WPC, value: amountIn, data: wrapData });
        await tx.wait();
        txHash = tx.hash;
      }
      onStep(0, "WRAP PC → WPC", "confirmed");
      return { txHash, success: true };
    }

    if (isUnwrap) {
      // Pure unwrap: WPC → PC via withdraw()
      onStep(0, "UNWRAP WPC → PC", "signing");
      console.log("[MoleSwap] Pure unwrap operation: WPC → PC");
      const wpcIface = new ethers.Interface(["function withdraw(uint256 wad)"]);
      const unwrapData = wpcIface.encodeFunctionData("withdraw", [amountIn]);
      let txHash = "";

      if (params.pushChainClient?.universal?.sendTransaction) {
        const unwrapResult = await params.pushChainClient.universal.sendTransaction({
          to: CONTRACTS.WPC, value: BigInt(0), data: unwrapData,
        });
        txHash = extractHash(unwrapResult);
        console.log("[MoleSwap] Unwrap tx:", unwrapResult, "hash:", txHash);
      } else if (typeof window !== "undefined" && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const tx = await signer.sendTransaction({ to: CONTRACTS.WPC, value: BigInt(0), data: unwrapData });
        await tx.wait();
        txHash = tx.hash;
      }
      onStep(0, "UNWRAP WPC → PC", "confirmed");
      return { txHash, success: true };
    }

    // ═══ ACTUAL SWAP (not wrap/unwrap) ═══

    // ═══ STEP 1: Wrap native PC → WPC (if native input) ═══
    if (isNativeIn) {
      onStep(0, "WRAP PC → WPC", "signing");
      console.log("[MoleSwap] Step 1: Wrapping PC → WPC...");
      const wpcIface = new ethers.Interface(["function deposit() payable"]);
      const wrapData = wpcIface.encodeFunctionData("deposit");

      if (params.pushChainClient?.universal?.sendTransaction) {
        const wrapTx = await params.pushChainClient.universal.sendTransaction({
          to: CONTRACTS.WPC,
          value: amountIn,
          data: wrapData,
        });
        console.log("[MoleSwap] Wrap tx:", wrapTx, "hash:", extractHash(wrapTx));
        
        // Poll WPC balance to confirm wrap landed on-chain
        const provider = getProvider();
        const wpcContract = new ethers.Contract(CONTRACTS.WPC, ERC20_ABI, provider);
        const balBefore = await wpcContract.balanceOf(params.recipient).catch(() => BigInt(0));
        console.log("[MoleSwap] WPC balance before wrap:", balBefore.toString());
        
        for (let attempt = 0; attempt < 12; attempt++) {
          await new Promise(r => setTimeout(r, 3000));
          const balNow = await wpcContract.balanceOf(params.recipient).catch(() => balBefore);
          console.log("[MoleSwap] WPC balance poll #" + (attempt + 1) + ":", balNow.toString());
          if (balNow > balBefore) {
            console.log("[MoleSwap] Wrap confirmed! WPC balance increased");
            break;
          }
          if (attempt === 11) {
            console.warn("[MoleSwap] Wrap may not have confirmed yet, proceeding anyway");
          }
        }
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
      onStep(0, "WRAP PC → WPC", "confirmed");
    } else {
      onStep(0, "WRAP PC → WPC", "confirmed"); // Skip — not native
    }

    // ═══ STEP 2: Check allowance, approve only if needed ═══
    onStep(1, "CHECKING ALLOWANCE", "signing");
    console.log("[MoleSwap] Step 2: Checking allowance...");
    const tokenToApprove = isNativeIn ? CONTRACTS.WPC : params.tokenIn;
    
    // Check on-chain allowance first
    let needsApproval = true;
    try {
      const provider = getProvider();
      const tokenContract = new ethers.Contract(tokenToApprove, ERC20_ABI, provider);
      const currentAllowance = await tokenContract.allowance(params.recipient, CONTRACTS.SWAP_ROUTER);
      needsApproval = currentAllowance < amountIn;
      console.log("[MoleSwap] Current allowance:", currentAllowance.toString(), "needs:", amountIn.toString(), "approve?", needsApproval);
    } catch (e) {
      console.warn("[MoleSwap] Allowance check failed, will approve:", e);
      needsApproval = true;
    }

    if (needsApproval) {
      onStep(1, "APPROVE TOKEN", "signing");
      if (params.pushChainClient?.universal?.sendTransaction) {
        const approveIface = new ethers.Interface(["function approve(address spender, uint256 amount) returns (bool)"]);
        const MAX_UINT = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
        const approveData = approveIface.encodeFunctionData("approve", [CONTRACTS.SWAP_ROUTER, MAX_UINT]);
        
        const approveTx = await params.pushChainClient.universal.sendTransaction({
          to: tokenToApprove,
          value: BigInt(0),
          data: approveData,
        });
        console.log("[MoleSwap] Approve tx:", approveTx, "hash:", extractHash(approveTx));
        
        // Poll allowance to confirm approve landed on-chain
        const providerForPoll = getProvider();
        const tokenForPoll = new ethers.Contract(tokenToApprove, ERC20_ABI, providerForPoll);
        for (let attempt = 0; attempt < 10; attempt++) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const newAllowance = await tokenForPoll.allowance(params.recipient, CONTRACTS.SWAP_ROUTER);
            console.log("[MoleSwap] Allowance poll #" + (attempt + 1) + ":", newAllowance.toString());
            if (newAllowance >= amountIn) {
              console.log("[MoleSwap] Approve confirmed on-chain!");
              break;
            }
          } catch {}
          if (attempt === 9) {
            console.warn("[MoleSwap] Approve may not have confirmed, proceeding anyway");
          }
        }
      } else if (typeof window !== "undefined" && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const token = new ethers.Contract(tokenToApprove, ERC20_ABI, signer);
        const MAX_UINT = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
        const tx = await token.approve(CONTRACTS.SWAP_ROUTER, MAX_UINT);
        await tx.wait();
        console.log("[MoleSwap] Approve confirmed:", tx.hash);
      }
    } else {
      console.log("[MoleSwap] Allowance sufficient, skipping approve");
    }
    onStep(1, "APPROVE TOKEN", "confirmed");

    // ═══ STEP 3: Execute swap (NO native value — we already wrapped) ═══
    onStep(2, "SWAP TOKENS", "signing");
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
      const swapResult = await params.pushChainClient.universal.sendTransaction({
        to: CONTRACTS.SWAP_ROUTER,
        value: BigInt(0), // NOT sending native — tokens are already wrapped
        data: swapCalldata,
      });
      txHash = extractHash(swapResult);
      console.log("[MoleSwap] Swap tx:", swapResult, "extracted hash:", txHash);
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

    onStep(2, "SWAP TOKENS", "confirmed");
    return { txHash, success: true };
  } catch (err: any) {
    console.error("[MoleSwap] Swap error:", err?.message || err);
    onStep(-1, err?.message || "Unknown error", "error");
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

// ═══ LIQUIDITY TYPES ═══
export interface AddLiquidityParams {
  pushChainClient: any;
  token0: string;       // token0 address (must be < token1 for Uni V3)
  token1: string;       // token1 address
  fee: number;          // pool fee tier (e.g. 500, 3000)
  amount0Desired: string; // wei
  amount1Desired: string; // wei
  recipient: string;
  tickLower?: number;   // defaults to full range
  tickUpper?: number;   // defaults to full range
  slippageBps?: number; // default 50 = 0.5%
  deadline?: number;
  onStep?: (step: number, label: string, status: "pending" | "signing" | "confirmed" | "error") => void;
}

export interface RemoveLiquidityParams {
  pushChainClient: any;
  tokenId: number;
  liquidity: string;     // amount of liquidity to remove (uint128)
  amount0Min?: string;   // wei, default 0
  amount1Min?: string;   // wei, default 0
  recipient: string;
  deadline?: number;
  burnAfter?: boolean;   // burn NFT if fully removed
  onStep?: (step: number, label: string, status: "pending" | "signing" | "confirmed" | "error") => void;
}

export interface LiquidityPosition {
  tokenId: number;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  tokensOwed0: string;
  tokensOwed1: string;
  token0Info?: TokenInfo;
  token1Info?: TokenInfo;
  poolInfo?: PoolInfo;
}

// ═══ TICK HELPERS ═══
function nearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;
  if (rounded < MIN_TICK) return MIN_TICK + tickSpacing;
  if (rounded > MAX_TICK) return MAX_TICK - tickSpacing;
  return rounded;
}

function getFullRangeTicks(fee: number): { tickLower: number; tickUpper: number } {
  const spacing = TICK_SPACINGS[fee] || 10;
  return {
    tickLower: nearestUsableTick(MIN_TICK, spacing),
    tickUpper: nearestUsableTick(MAX_TICK, spacing),
  };
}

// ═══ ORDER TOKENS (Uniswap V3 requires token0 < token1) ═══
function orderTokens(tokenA: string, tokenB: string): { token0: string; token1: string; reversed: boolean } {
  const a = tokenA.toLowerCase();
  const b = tokenB.toLowerCase();
  if (a < b) return { token0: tokenA, token1: tokenB, reversed: false };
  return { token0: tokenB, token1: tokenA, reversed: true };
}

// ═══ ADD LIQUIDITY ═══
export async function addLiquidity(params: AddLiquidityParams): Promise<{ txHash: string; success: boolean; tokenId?: number; error?: string }> {
  const onStep = params.onStep || (() => {});
  try {
    const isNative0 = params.token0 === ethers.ZeroAddress;
    const isNative1 = params.token1 === ethers.ZeroAddress;
    const actual0 = isNative0 ? CONTRACTS.WPC : params.token0;
    const actual1 = isNative1 ? CONTRACTS.WPC : params.token1;

    // Order tokens for Uniswap V3
    const { token0, token1, reversed } = orderTokens(actual0, actual1);
    const amount0 = reversed ? BigInt(params.amount1Desired) : BigInt(params.amount0Desired);
    const amount1 = reversed ? BigInt(params.amount0Desired) : BigInt(params.amount1Desired);

    const slippage = params.slippageBps || 50; // 0.5%
    const amount0Min = amount0 * BigInt(10000 - slippage) / 10000n;
    const amount1Min = amount1 * BigInt(10000 - slippage) / 10000n;
    const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1800;

    // Tick range
    const fee = params.fee || 500;
    let { tickLower, tickUpper } = params.tickLower != null && params.tickUpper != null
      ? { tickLower: params.tickLower, tickUpper: params.tickUpper }
      : getFullRangeTicks(fee);

    const needsWrap = isNative0 || isNative1;
    const wrapAmount = isNative0 ? BigInt(params.amount0Desired) : isNative1 ? BigInt(params.amount1Desired) : 0n;

    console.log("[MoleSwap] addLiquidity:", { token0: token0.slice(0,10), token1: token1.slice(0,10), fee, tickLower, tickUpper, needsWrap });

    // ═══ STEP 0: Wrap native PC → WPC if needed ═══
    if (needsWrap && wrapAmount > 0n) {
      onStep(0, "WRAP PC → WPC", "signing");
      const wrapIface = new ethers.Interface(["function deposit() payable"]);
      const wrapData = wrapIface.encodeFunctionData("deposit");

      if (params.pushChainClient?.universal?.sendTransaction) {
        await params.pushChainClient.universal.sendTransaction({
          to: CONTRACTS.WPC, value: wrapAmount, data: wrapData,
        });
        await new Promise(r => setTimeout(r, 5000));
      } else if (typeof window !== "undefined" && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const tx = await signer.sendTransaction({ to: CONTRACTS.WPC, value: wrapAmount, data: wrapData });
        await tx.wait();
      }
      onStep(0, "WRAP PC → WPC", "confirmed");
    } else {
      onStep(0, "WRAP PC → WPC", "confirmed");
    }

    // ═══ STEP 1: Approve token0 for PositionManager ═══
    onStep(1, `APPROVE ${token0.slice(0,6)}...`, "signing");
    const MAX_UINT = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
    const approveIface = new ethers.Interface(["function approve(address, uint256) returns (bool)"]);

    if (params.pushChainClient?.universal?.sendTransaction) {
      await params.pushChainClient.universal.sendTransaction({
        to: token0, value: 0n, data: approveIface.encodeFunctionData("approve", [CONTRACTS.POSITION_MANAGER, MAX_UINT]),
      });
      await new Promise(r => setTimeout(r, 5000));
    } else if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const t0 = new ethers.Contract(token0, ERC20_ABI, signer);
      const tx = await t0.approve(CONTRACTS.POSITION_MANAGER, MAX_UINT);
      await tx.wait();
    }
    onStep(1, `APPROVE ${token0.slice(0,6)}...`, "confirmed");

    // ═══ STEP 2: Approve token1 for PositionManager ═══
    onStep(2, `APPROVE ${token1.slice(0,6)}...`, "signing");
    if (params.pushChainClient?.universal?.sendTransaction) {
      await params.pushChainClient.universal.sendTransaction({
        to: token1, value: 0n, data: approveIface.encodeFunctionData("approve", [CONTRACTS.POSITION_MANAGER, MAX_UINT]),
      });
      await new Promise(r => setTimeout(r, 5000));
    } else if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const t1 = new ethers.Contract(token1, ERC20_ABI, signer);
      const tx = await t1.approve(CONTRACTS.POSITION_MANAGER, MAX_UINT);
      await tx.wait();
    }
    onStep(2, `APPROVE ${token1.slice(0,6)}...`, "confirmed");

    // ═══ STEP 3: Mint position via PositionManager ═══
    onStep(3, "MINT POSITION", "signing");
    const pmIface = new ethers.Interface(POSITION_MANAGER_ABI);
    const mintCalldata = pmIface.encodeFunctionData("mint", [{
      token0, token1, fee, tickLower, tickUpper,
      amount0Desired: amount0,
      amount1Desired: amount1,
      amount0Min, amount1Min,
      recipient: params.recipient,
      deadline,
    }]);

    let txHash = "";
    if (params.pushChainClient?.universal?.sendTransaction) {
      const mintResult = await params.pushChainClient.universal.sendTransaction({
        to: CONTRACTS.POSITION_MANAGER,
        value: 0n,
        data: mintCalldata,
      });
      txHash = extractHash(mintResult);
      console.log("[MoleSwap] Mint tx:", mintResult, "extracted hash:", txHash);
    } else if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: CONTRACTS.POSITION_MANAGER,
        value: 0n,
        data: mintCalldata,
      });
      const receipt = await tx.wait();
      txHash = receipt?.hash || tx.hash;
    } else {
      throw new Error("No wallet available");
    }

    if (!txHash) throw new Error("Mint transaction returned empty hash");

    onStep(3, "MINT POSITION", "confirmed");
    return { txHash, success: true };
  } catch (err: any) {
    console.error("[MoleSwap] Add liquidity error:", err?.message || err);
    onStep(-1, err?.message || "Unknown error", "error");
    return { txHash: "", success: false, error: err?.message || "Add liquidity failed" };
  }
}

// ═══ REMOVE LIQUIDITY ═══
export async function removeLiquidity(params: RemoveLiquidityParams): Promise<{ txHash: string; success: boolean; error?: string }> {
  const onStep = params.onStep || (() => {});
  try {
    const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1800;
    const liquidity = BigInt(params.liquidity);
    const amount0Min = BigInt(params.amount0Min || "0");
    const amount1Min = BigInt(params.amount1Min || "0");
    const MAX_UINT128 = BigInt("340282366920938463463374607431768211455");

    const pmIface = new ethers.Interface(POSITION_MANAGER_ABI);

    // ═══ STEP 0: Decrease liquidity ═══
    onStep(0, "DECREASE LIQUIDITY", "signing");
    const decreaseCalldata = pmIface.encodeFunctionData("decreaseLiquidity", [{
      tokenId: params.tokenId,
      liquidity,
      amount0Min,
      amount1Min,
      deadline,
    }]);

    let txHash = "";
    if (params.pushChainClient?.universal?.sendTransaction) {
      const decreaseResult = await params.pushChainClient.universal.sendTransaction({
        to: CONTRACTS.POSITION_MANAGER, value: 0n, data: decreaseCalldata,
      });
      txHash = extractHash(decreaseResult);
      await new Promise(r => setTimeout(r, 3000));
    } else if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: CONTRACTS.POSITION_MANAGER, value: 0n, data: decreaseCalldata,
      });
      await tx.wait();
      txHash = tx.hash;
    }
    onStep(0, "DECREASE LIQUIDITY", "confirmed");

    // ═══ STEP 1: Collect tokens ═══
    onStep(1, "COLLECT TOKENS", "signing");
    const collectCalldata = pmIface.encodeFunctionData("collect", [{
      tokenId: params.tokenId,
      recipient: params.recipient,
      amount0Max: MAX_UINT128,
      amount1Max: MAX_UINT128,
    }]);

    if (params.pushChainClient?.universal?.sendTransaction) {
      const collectResult = await params.pushChainClient.universal.sendTransaction({
        to: CONTRACTS.POSITION_MANAGER, value: 0n, data: collectCalldata,
      });
      txHash = extractHash(collectResult) || txHash;
      await new Promise(r => setTimeout(r, 3000));
    } else if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: CONTRACTS.POSITION_MANAGER, value: 0n, data: collectCalldata,
      });
      await tx.wait();
      txHash = tx.hash;
    }
    onStep(1, "COLLECT TOKENS", "confirmed");

    // ═══ STEP 2: Burn NFT (optional, if fully removed) ═══
    if (params.burnAfter) {
      onStep(2, "BURN POSITION NFT", "signing");
      const burnCalldata = pmIface.encodeFunctionData("burn", [params.tokenId]);

      if (params.pushChainClient?.universal?.sendTransaction) {
        await params.pushChainClient.universal.sendTransaction({
          to: CONTRACTS.POSITION_MANAGER, value: 0n, data: burnCalldata,
        });
      } else if (typeof window !== "undefined" && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const tx = await signer.sendTransaction({
          to: CONTRACTS.POSITION_MANAGER, value: 0n, data: burnCalldata,
        });
        await tx.wait();
      }
      onStep(2, "BURN POSITION NFT", "confirmed");
    }

    return { txHash, success: true };
  } catch (err: any) {
    console.error("[MoleSwap] Remove liquidity error:", err?.message || err);
    onStep(-1, err?.message || "Unknown error", "error");
    return { txHash: "", success: false, error: err?.message || "Remove liquidity failed" };
  }
}

// ═══ GET USER POSITIONS ═══
export async function getUserPositions(userAddress: string): Promise<LiquidityPosition[]> {
  try {
    const provider = getProvider();
    const pm = new ethers.Contract(CONTRACTS.POSITION_MANAGER, POSITION_MANAGER_ABI, provider);

    const balance = await pm.balanceOf(userAddress);
    const count = Number(balance);
    if (count === 0) return [];

    const positions: LiquidityPosition[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const tokenId = await pm.tokenOfOwnerByIndex(userAddress, i);
        const pos = await pm.positions(tokenId);

        const token0Info = getTokenByAddress(pos.token0);
        const token1Info = getTokenByAddress(pos.token1);
        const poolInfo = findPool(pos.token0, pos.token1);

        positions.push({
          tokenId: Number(tokenId),
          token0: pos.token0,
          token1: pos.token1,
          fee: Number(pos.fee),
          tickLower: Number(pos.tickLower),
          tickUpper: Number(pos.tickUpper),
          liquidity: pos.liquidity.toString(),
          tokensOwed0: pos.tokensOwed0.toString(),
          tokensOwed1: pos.tokensOwed1.toString(),
          token0Info,
          token1Info,
          poolInfo,
        });
      } catch (e) {
        console.error(`Error reading position index ${i}:`, e);
      }
    }
    return positions;
  } catch (err) {
    console.error("Get user positions error:", err);
    return [];
  }
}

// ═══ COLLECT FEES FROM POSITION ═══
export async function collectFees(params: {
  pushChainClient: any;
  tokenId: number;
  recipient: string;
}): Promise<{ txHash: string; success: boolean; error?: string }> {
  try {
    const MAX_UINT128 = BigInt("340282366920938463463374607431768211455");
    const pmIface = new ethers.Interface(POSITION_MANAGER_ABI);
    const calldata = pmIface.encodeFunctionData("collect", [{
      tokenId: params.tokenId,
      recipient: params.recipient,
      amount0Max: MAX_UINT128,
      amount1Max: MAX_UINT128,
    }]);

    let txHash = "";
    if (params.pushChainClient?.universal?.sendTransaction) {
      const collectResult = await params.pushChainClient.universal.sendTransaction({
        to: CONTRACTS.POSITION_MANAGER, value: 0n, data: calldata,
      });
      txHash = extractHash(collectResult);
    } else if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({ to: CONTRACTS.POSITION_MANAGER, value: 0n, data: calldata });
      await tx.wait();
      txHash = tx.hash;
    }

    return { txHash, success: true };
  } catch (err: any) {
    return { txHash: "", success: false, error: err?.message };
  }
}

export async function getPairReserves(tokenA: string, tokenB: string) {
  try {
    const actualA = tokenA === ethers.ZeroAddress ? CONTRACTS.WPC : tokenA;
    const actualB = tokenB === ethers.ZeroAddress ? CONTRACTS.WPC : tokenB;
    const pool = findPool(actualA, actualB);
    if (!pool) return { reserve0: "0", reserve1: "0" };

    const provider = getProvider();
    const token0Contract = new ethers.Contract(pool.token0, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(pool.token1, ERC20_ABI, provider);

    const [bal0, bal1] = await Promise.all([
      token0Contract.balanceOf(pool.address),
      token1Contract.balanceOf(pool.address),
    ]);

    return {
      reserve0: bal0.toString(),
      reserve1: bal1.toString(),
    };
  } catch (err) {
    console.error("getPairReserves error:", err);
    return { reserve0: "0", reserve1: "0" };
  }
}
