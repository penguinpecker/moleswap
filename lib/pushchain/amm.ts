/**
 * PushChain AMM — Uniswap V3-style Concentrated Liquidity
 * Interacts with deployed contracts on Push Chain Donut Testnet
 */
import { ethers } from "ethers";
import {
  CONTRACTS, TOKENS, POOLS, PUSHCHAIN_RPC, PUSHCHAIN_CHAIN_ID,
  QUOTER_V2_ABI, SWAP_ROUTER_ABI, ERC20_ABI, POOL_ABI,
  POSITION_MANAGER_ABI, WPC_ABI, FEE_ROUTER_ABI, LIQUIDITY_PROXY_ABI,
  TICK_SPACINGS, MIN_TICK, MAX_TICK,
  getTokenByAddress, findPool, getSwappableTokens,
  type TokenInfo, type PoolInfo,
} from "./contracts";

export {
  CONTRACTS, TOKENS, POOLS, PUSHCHAIN_RPC, PUSHCHAIN_CHAIN_ID,
  getTokenByAddress, findPool, getSwappableTokens,
  type TokenInfo, type PoolInfo,
};

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

// ═══ UNIVERSAL TX OPTIONS (fee abstraction + progress) ═══
export interface UniversalTxOptions {
  payGasWithToken?: string;
  payGasSlippageBps?: number;
  onProgress?: (progress: { id: string; title: string; message: string; level: string; timestamp: string }) => void;
}

// ═══ HELPER: Send universal tx with fee abstraction + progress hooks ═══
async function sendUniversalTx(
  pushChainClient: any,
  tx: { to: string; value: bigint; data?: string },
  options?: UniversalTxOptions,
): Promise<any> {
  const txParams: any = { ...tx };

  if (options?.payGasWithToken) {
    txParams.payGasWith = {
      token: options.payGasWithToken,
      slippageBps: options.payGasSlippageBps || 200,
    };
  }

  if (options?.onProgress) {
    txParams.progressHook = options.onProgress;
  }

  return pushChainClient.universal.sendTransaction(txParams);
}

// ═══ HELPER: Send EVM tx preferring direct signing over Universal TX ═══
// Universal TX routes through a Cosmos executor contract, making msg.sender
// the executor — not the user. This breaks WETH deposit/withdraw (credits
// wrong address), ERC20 approve (sets wrong allowance), and transferFrom
// (pulls from wrong address). Direct EVM signing keeps msg.sender = user.
async function sendTx(
  pushChainClient: any,
  tx: { to: string; value: bigint; data?: string },
  options?: UniversalTxOptions,
): Promise<any> {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      if (Number(network.chainId) === PUSHCHAIN_CHAIN_ID) {
        console.log("[MoleSwap] Using direct EVM signing (msg.sender = user)");
        const sent = await signer.sendTransaction({
          to: tx.to,
          value: tx.value,
          data: tx.data || "0x",
        });
        const receipt = await sent.wait();
        return receipt?.hash || sent.hash;
      }
    } catch (e: any) {
      console.warn("[MoleSwap] Direct EVM signing failed, falling back to Universal TX:", e?.message);
    }
  }
  console.log("[MoleSwap] Using Universal TX (Cosmos-wrapped EVM)");
  return sendUniversalTx(pushChainClient, tx, options);
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

    if (tokenInInfo.swappable === false || tokenOutInfo.swappable === false) return null;

    const amountInWei = BigInt(params.amountIn || "0");
    if (amountInWei === 0n) return null;

    const actualIn = params.tokenIn === ethers.ZeroAddress ? CONTRACTS.WPC : params.tokenIn;
    const actualOut = params.tokenOut === ethers.ZeroAddress ? CONTRACTS.WPC : params.tokenOut;

    const isWrapOrUnwrap = actualIn.toLowerCase() === actualOut.toLowerCase();
    if (isWrapOrUnwrap) {
      return {
        amountIn: params.amountIn,
        amountOut: params.amountIn,
        tokenIn: tokenInInfo,
        tokenOut: tokenOutInfo,
        fee: 0,
        pool: { address: CONTRACTS.WPC, token0: params.tokenIn, token1: params.tokenOut, fee: 0, name: "WRAP" } as any,
        priceImpact: 0,
        gasEstimate: "50000",
      };
    }

    let pool = findPool(actualIn, actualOut);
    let fee = params.fee || pool?.fee || 500;

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
          amountOut: finalAmount.toString(),
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
      amountOut: amountOut.toString(),
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
function extractHash(result: any): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  
  const directKeys = [
    "hash", "txHash", "txnHash", "transactionHash", "transactionhash",
    "tx_hash", "txn_hash", "transaction_hash",
  ];
  for (const key of directKeys) {
    if (result[key] && typeof result[key] === "string") return result[key];
  }
  
  if (result.tx?.hash) return result.tx.hash;
  if (result.receipt?.transactionHash) return result.receipt.transactionHash;
  if (result.receipt?.hash) return result.receipt.hash;
  if (result.response?.hash) return result.response.hash;
  if (result.data?.hash) return result.data.hash;
  if (result.data?.txHash) return result.data.txHash;
  
  const hashRegex = /^0x[a-fA-F0-9]{64}$/;
  for (const val of Object.values(result)) {
    if (typeof val === "string" && hashRegex.test(val)) return val;
  }
  
  for (const val of Object.values(result)) {
    if (val && typeof val === "object") {
      for (const inner of Object.values(val as any)) {
        if (typeof inner === "string" && hashRegex.test(inner)) return inner;
      }
    }
  }
  
  console.warn("[MoleSwap] Could not extract hash from:", JSON.stringify(result).slice(0, 200));
  return "";
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
  universalTxOptions?: UniversalTxOptions;
  onStep?: (step: number, label: string, status: "pending" | "signing" | "confirmed" | "error") => void;
}): Promise<{ txHash: string; success: boolean; error?: string }> {
  const onStep = params.onStep || (() => {});
  const uOpts = params.universalTxOptions;
  try {
    const isNativeIn = params.tokenIn === ethers.ZeroAddress;
    const actualIn = isNativeIn ? CONTRACTS.WPC : params.tokenIn;
    const actualOut = params.tokenOut === ethers.ZeroAddress ? CONTRACTS.WPC : params.tokenOut;
    const pool = findPool(actualIn, actualOut);
    const fee = params.fee || pool?.fee || 500;

    const amountIn = BigInt(params.amountIn);
    const amountOutMin = BigInt(params.amountOutMin) * 95n / 100n;
    const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1800;

    console.log("[MoleSwap] executeSwap:", {
      isNativeIn,
      tokenIn: actualIn.slice(0,10),
      tokenOut: actualOut.slice(0,10),
      amountIn: amountIn.toString(),
      fee,
      feeAbstraction: !!uOpts?.payGasWithToken,
    });

    const isWrap = isNativeIn && actualOut.toLowerCase() === CONTRACTS.WPC.toLowerCase();
    const isUnwrap = actualIn.toLowerCase() === CONTRACTS.WPC.toLowerCase() && params.tokenOut === ethers.ZeroAddress;
    
    if (isWrap) {
      onStep(0, "WRAP PC → WPC", "signing");
      const wpcIface = new ethers.Interface(["function deposit() payable"]);
      const wrapData = wpcIface.encodeFunctionData("deposit");

      const wrapResult = await sendTx(params.pushChainClient, {
        to: CONTRACTS.WPC, value: amountIn, data: wrapData,
      }, uOpts);
      const txHash = extractHash(wrapResult);

      onStep(0, "WRAP PC → WPC", "confirmed");
      return { txHash, success: true };
    }

    if (isUnwrap) {
      onStep(0, "UNWRAP WPC → PC", "signing");
      const wpcIface = new ethers.Interface(["function withdraw(uint256 wad)"]);
      const unwrapData = wpcIface.encodeFunctionData("withdraw", [amountIn]);

      const unwrapResult = await sendTx(params.pushChainClient, {
        to: CONTRACTS.WPC, value: BigInt(0), data: unwrapData,
      }, uOpts);
      const txHash = extractHash(unwrapResult);

      onStep(0, "UNWRAP WPC → PC", "confirmed");
      return { txHash, success: true };
    }

    // ═══ STEP 1: Wrap native PC → WPC (if native input) ═══
    if (isNativeIn) {
      onStep(0, "WRAP PC → WPC", "signing");
      const wpcIface = new ethers.Interface(["function deposit() payable"]);
      const wrapData = wpcIface.encodeFunctionData("deposit");

      const wrapTx = await sendTx(params.pushChainClient, {
        to: CONTRACTS.WPC, value: amountIn, data: wrapData,
      }, uOpts);
      console.log("[MoleSwap] Wrap tx:", extractHash(wrapTx));
      
      const directEvmConfirmed = typeof wrapTx === "string";
      if (!directEvmConfirmed) {
        const provider = getProvider();
        const wpcContract = new ethers.Contract(CONTRACTS.WPC, ERC20_ABI, provider);
        const balBefore = await wpcContract.balanceOf(params.recipient).catch(() => BigInt(0));
        
        for (let attempt = 0; attempt < 12; attempt++) {
          await new Promise(r => setTimeout(r, 3000));
          const balNow = await wpcContract.balanceOf(params.recipient).catch(() => balBefore);
          if (balNow > balBefore) break;
          if (attempt === 11) console.warn("[MoleSwap] Wrap may not have confirmed yet, proceeding anyway");
        }
      }
      onStep(0, "WRAP PC → WPC", "confirmed");
    } else {
      onStep(0, "WRAP PC → WPC", "confirmed");
    }

    // ═══ STEP 2: Check allowance, approve only if needed ═══
    onStep(1, "CHECKING ALLOWANCE", "signing");
    const tokenToApprove = isNativeIn ? CONTRACTS.WPC : params.tokenIn;
    
    let needsApproval = true;
    try {
      const provider = getProvider();
      const tokenContract = new ethers.Contract(tokenToApprove, ERC20_ABI, provider);
      const currentAllowance = await tokenContract.allowance(params.recipient, CONTRACTS.MOLESWAP_FEE_ROUTER);
      needsApproval = currentAllowance < amountIn;
    } catch (e) {
      needsApproval = true;
    }

    if (needsApproval) {
      onStep(1, "APPROVE TOKEN", "signing");
      const approveIface = new ethers.Interface(["function approve(address spender, uint256 amount) returns (bool)"]);
      const MAX_UINT = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
      const approveData = approveIface.encodeFunctionData("approve", [CONTRACTS.MOLESWAP_FEE_ROUTER, MAX_UINT]);
      
      const approveTx = await sendTx(params.pushChainClient, {
        to: tokenToApprove, value: BigInt(0), data: approveData,
      }, uOpts);
      
      if (typeof approveTx !== "string") {
        const providerForPoll = getProvider();
        const tokenForPoll = new ethers.Contract(tokenToApprove, ERC20_ABI, providerForPoll);
        for (let attempt = 0; attempt < 10; attempt++) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const newAllowance = await tokenForPoll.allowance(params.recipient, CONTRACTS.MOLESWAP_FEE_ROUTER);
            if (newAllowance >= amountIn) break;
          } catch {}
          if (attempt === 9) console.warn("[MoleSwap] Approve may not have confirmed, proceeding anyway");
        }
      }
    }
    onStep(1, "APPROVE TOKEN", "confirmed");

    // ═══ STEP 3: Execute swap via MoleSwap FeeRouter ═══
    onStep(2, "SWAP TOKENS", "signing");
    const iface = new ethers.Interface(FEE_ROUTER_ABI);
    const swapCalldata = iface.encodeFunctionData("swapExactInputSingle", [
      actualIn,
      actualOut,
      fee,
      amountIn,
      amountOutMin,
      deadline,
      0,
    ]);

    const swapResult = await sendTx(params.pushChainClient, {
      to: CONTRACTS.MOLESWAP_FEE_ROUTER, value: BigInt(0), data: swapCalldata,
    }, uOpts);
    const txHash = extractHash(swapResult);

    if (!txHash) throw new Error("Swap transaction returned empty hash");

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
  amountWei: string,
): Promise<string | null> {
  try {
    if (typeof window === "undefined" || !(window as any).ethereum) return null;
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const tx = await token.approve(CONTRACTS.MOLESWAP_FEE_ROUTER, BigInt(amountWei));
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
  token0: string;
  token1: string;
  fee: number;
  amount0Desired: string;
  amount1Desired: string;
  recipient: string;
  tickLower?: number;
  tickUpper?: number;
  slippageBps?: number;
  deadline?: number;
  universalTxOptions?: UniversalTxOptions;
  onStep?: (step: number, label: string, status: "pending" | "signing" | "confirmed" | "error") => void;
}

export interface RemoveLiquidityParams {
  pushChainClient: any;
  tokenId: number;
  liquidity: string;
  amount0Min?: string;
  amount1Min?: string;
  recipient: string;
  deadline?: number;
  burnAfter?: boolean;
  universalTxOptions?: UniversalTxOptions;
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

function orderTokens(tokenA: string, tokenB: string): { token0: string; token1: string; reversed: boolean } {
  const a = tokenA.toLowerCase();
  const b = tokenB.toLowerCase();
  if (a < b) return { token0: tokenA, token1: tokenB, reversed: false };
  return { token0: tokenB, token1: tokenA, reversed: true };
}

// ═══ ADD LIQUIDITY ═══
export async function addLiquidity(params: AddLiquidityParams): Promise<{ txHash: string; success: boolean; tokenId?: number; error?: string }> {
  const onStep = params.onStep || (() => {});
  const uOpts = params.universalTxOptions;
  try {
    const isNative0 = params.token0 === ethers.ZeroAddress;
    const isNative1 = params.token1 === ethers.ZeroAddress;
    const actual0 = isNative0 ? CONTRACTS.WPC : params.token0;
    const actual1 = isNative1 ? CONTRACTS.WPC : params.token1;

    const { token0, token1, reversed } = orderTokens(actual0, actual1);
    const amount0 = reversed ? BigInt(params.amount1Desired) : BigInt(params.amount0Desired);
    const amount1 = reversed ? BigInt(params.amount0Desired) : BigInt(params.amount1Desired);

    const slippage = params.slippageBps || 50;
    const amount0Min = amount0 * BigInt(10000 - slippage) / 10000n;
    const amount1Min = amount1 * BigInt(10000 - slippage) / 10000n;
    const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1800;

    const fee = params.fee || 500;
    const spacing = TICK_SPACINGS[fee] || 10;
    let { tickLower, tickUpper } = params.tickLower != null && params.tickUpper != null
      ? { tickLower: nearestUsableTick(params.tickLower, spacing), tickUpper: nearestUsableTick(params.tickUpper, spacing) }
      : getFullRangeTicks(fee);

    const needsWrap = isNative0 || isNative1;
    const wrapAmount = isNative0 ? BigInt(params.amount0Desired) : isNative1 ? BigInt(params.amount1Desired) : 0n;

    // ═══ STEP 0: Wrap native PC → WPC if needed ═══
    if (needsWrap && wrapAmount > 0n) {
      onStep(0, "WRAP PC → WPC", "signing");
      const wrapIface = new ethers.Interface(["function deposit() payable"]);
      const wrapData = wrapIface.encodeFunctionData("deposit");

      await sendTx(params.pushChainClient, {
        to: CONTRACTS.WPC, value: wrapAmount, data: wrapData,
      }, uOpts);
      await new Promise(r => setTimeout(r, 5000));
      onStep(0, "WRAP PC → WPC", "confirmed");
    } else {
      onStep(0, "WRAP PC → WPC", "confirmed");
    }

    // ═══ STEP 1: Approve token0 to LiquidityProxy ═══
    onStep(1, `APPROVE ${token0.slice(0,6)}...`, "signing");
    const MAX_UINT = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
    const approveIface = new ethers.Interface(["function approve(address, uint256) returns (bool)"]);

    await sendTx(params.pushChainClient, {
      to: token0, value: 0n, data: approveIface.encodeFunctionData("approve", [CONTRACTS.MOLESWAP_LIQUIDITY_PROXY, MAX_UINT]),
    }, uOpts);
    await new Promise(r => setTimeout(r, 5000));
    onStep(1, `APPROVE ${token0.slice(0,6)}...`, "confirmed");

    // ═══ STEP 2: Approve token1 to LiquidityProxy ═══
    onStep(2, `APPROVE ${token1.slice(0,6)}...`, "signing");
    await sendTx(params.pushChainClient, {
      to: token1, value: 0n, data: approveIface.encodeFunctionData("approve", [CONTRACTS.MOLESWAP_LIQUIDITY_PROXY, MAX_UINT]),
    }, uOpts);
    await new Promise(r => setTimeout(r, 5000));
    onStep(2, `APPROVE ${token1.slice(0,6)}...`, "confirmed");

    // ═══ STEP 3: Mint position via LiquidityProxy ═══
    onStep(3, "MINT POSITION", "signing");
    const proxyIface = new ethers.Interface(LIQUIDITY_PROXY_ABI);
    const mintCalldata = proxyIface.encodeFunctionData("mint", [{
      token0, token1, fee, tickLower, tickUpper,
      amount0Desired: amount0,
      amount1Desired: amount1,
      amount0Min, amount1Min,
      deadline,
    }]);

    const mintResult = await sendTx(params.pushChainClient, {
      to: CONTRACTS.MOLESWAP_LIQUIDITY_PROXY, value: 0n, data: mintCalldata,
    }, uOpts);
    const txHash = extractHash(mintResult);

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
  const uOpts = params.universalTxOptions;
  try {
    const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1800;
    const liquidity = BigInt(params.liquidity);
    const amount0Min = BigInt(params.amount0Min || "0");
    const amount1Min = BigInt(params.amount1Min || "0");
    const MAX_UINT128 = BigInt("340282366920938463463374607431768211455");

    // ═══ STEP 0: Ensure LiquidityProxy is approved as operator on PositionManager ═══
    onStep(0, "CHECK PROXY APPROVAL", "signing");
    const provider = getProvider();
    const pm = new ethers.Contract(CONTRACTS.POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
    const isApproved = await pm.isApprovedForAll(params.recipient, CONTRACTS.MOLESWAP_LIQUIDITY_PROXY).catch(() => false);

    if (!isApproved) {
      const pmIface = new ethers.Interface(POSITION_MANAGER_ABI);
      const approveData = pmIface.encodeFunctionData("setApprovalForAll", [CONTRACTS.MOLESWAP_LIQUIDITY_PROXY, true]);
      await sendTx(params.pushChainClient, {
        to: CONTRACTS.POSITION_MANAGER, value: 0n, data: approveData,
      }, uOpts);
      await new Promise(r => setTimeout(r, 5000));
    }
    onStep(0, "CHECK PROXY APPROVAL", "confirmed");

    const proxyIface = new ethers.Interface(LIQUIDITY_PROXY_ABI);

    // ═══ STEP 1: Decrease liquidity via LiquidityProxy ═══
    onStep(1, "DECREASE LIQUIDITY", "signing");
    const decreaseCalldata = proxyIface.encodeFunctionData("decreaseLiquidity", [
      params.tokenId, liquidity, amount0Min, amount1Min, deadline,
    ]);

    const decreaseResult = await sendTx(params.pushChainClient, {
      to: CONTRACTS.MOLESWAP_LIQUIDITY_PROXY, value: 0n, data: decreaseCalldata,
    }, uOpts);
    let txHash = extractHash(decreaseResult);
    await new Promise(r => setTimeout(r, 3000));
    onStep(1, "DECREASE LIQUIDITY", "confirmed");

    // ═══ STEP 2: Collect tokens via LiquidityProxy ═══
    onStep(2, "COLLECT TOKENS", "signing");
    const collectCalldata = proxyIface.encodeFunctionData("collect", [
      params.tokenId, MAX_UINT128, MAX_UINT128,
    ]);

    const collectResult = await sendTx(params.pushChainClient, {
      to: CONTRACTS.MOLESWAP_LIQUIDITY_PROXY, value: 0n, data: collectCalldata,
    }, uOpts);
    txHash = extractHash(collectResult) || txHash;
    await new Promise(r => setTimeout(r, 3000));
    onStep(2, "COLLECT TOKENS", "confirmed");

    // ═══ STEP 3: Burn NFT (optional) via LiquidityProxy ═══
    if (params.burnAfter) {
      onStep(3, "BURN POSITION NFT", "signing");
      const burnCalldata = proxyIface.encodeFunctionData("burn", [params.tokenId]);

      await sendTx(params.pushChainClient, {
        to: CONTRACTS.MOLESWAP_LIQUIDITY_PROXY, value: 0n, data: burnCalldata,
      }, uOpts);
      onStep(3, "BURN POSITION NFT", "confirmed");
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
  universalTxOptions?: UniversalTxOptions;
}): Promise<{ txHash: string; success: boolean; error?: string }> {
  try {
    const MAX_UINT128 = BigInt("340282366920938463463374607431768211455");

    // Ensure proxy is approved as operator
    const provider = getProvider();
    const pm = new ethers.Contract(CONTRACTS.POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
    const isApproved = await pm.isApprovedForAll(params.recipient, CONTRACTS.MOLESWAP_LIQUIDITY_PROXY).catch(() => false);

    if (!isApproved) {
      const pmIface = new ethers.Interface(POSITION_MANAGER_ABI);
      const approveData = pmIface.encodeFunctionData("setApprovalForAll", [CONTRACTS.MOLESWAP_LIQUIDITY_PROXY, true]);
      await sendTx(params.pushChainClient, {
        to: CONTRACTS.POSITION_MANAGER, value: 0n, data: approveData,
      }, params.universalTxOptions);
      await new Promise(r => setTimeout(r, 5000));
    }

    const proxyIface = new ethers.Interface(LIQUIDITY_PROXY_ABI);
    const calldata = proxyIface.encodeFunctionData("collect", [
      params.tokenId, MAX_UINT128, MAX_UINT128,
    ]);

    const collectResult = await sendTx(params.pushChainClient, {
      to: CONTRACTS.MOLESWAP_LIQUIDITY_PROXY, value: 0n, data: calldata,
    }, params.universalTxOptions);
    const txHash = extractHash(collectResult);

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
