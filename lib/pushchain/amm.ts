/**
 * PushChain AMM — Uniswap V2 Fork
 * Full on-chain integration with Factory, Router, Pair contracts
 */

import { ethers } from "ethers";

// PushChain EVM Config
export const PUSHCHAIN_RPC = "https://evm.donut.rpc.push.org/";
export const PUSHCHAIN_CHAIN_ID = 2442;

// Contract addresses — set via env or after deployment
export const AMM_FACTORY = process.env.NEXT_PUBLIC_AMM_FACTORY || "";
export const AMM_ROUTER = process.env.NEXT_PUBLIC_AMM_ROUTER || "";
export const WETH_ADDRESS = process.env.NEXT_PUBLIC_WETH_ADDRESS || "";

// ============================================
// ABIs
// ============================================

export const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
  "function allPairs(uint256 index) view returns (address pair)",
  "function allPairsLength() view returns (uint256)",
  "function feeTo() view returns (address)",
  "function createPair(address tokenA, address tokenB) returns (address pair)",
];

export const ROUTER_ABI = [
  "function factory() view returns (address)",
  "function WETH() view returns (address)",
  "function getAmountsOut(uint256 amountIn, address[] memory path) view returns (uint256[] memory amounts)",
  "function getAmountsIn(uint256 amountOut, address[] memory path) view returns (uint256[] memory amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)",
  "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB, uint256 liquidity)",
  "function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)",
  "function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB)",
  "function removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) external returns (uint256 amountToken, uint256 amountETH)",
  "function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) pure returns (uint256 amountB)",
];

export const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

// ============================================
// Types
// ============================================

export interface PushChainToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export interface Pool {
  pairAddress: string;
  token0: PushChainToken;
  token1: PushChainToken;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  userLiquidity: string;
  userShare: string;
}

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  path: string[];
  priceImpact: number;
  executionPrice: string;
  minimumReceived: string;
}

// ============================================
// Provider
// ============================================

export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(PUSHCHAIN_RPC);
}

export function getRouter(signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
  return new ethers.Contract(AMM_ROUTER, ROUTER_ABI, signerOrProvider || getProvider());
}

export function getFactory(signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
  return new ethers.Contract(AMM_FACTORY, FACTORY_ABI, signerOrProvider || getProvider());
}

export function getPairContract(pairAddress: string, signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
  return new ethers.Contract(pairAddress, PAIR_ABI, signerOrProvider || getProvider());
}

export function getERC20(tokenAddress: string, signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
  return new ethers.Contract(tokenAddress, ERC20_ABI, signerOrProvider || getProvider());
}

// ============================================
// Read Functions
// ============================================

/** Get a swap quote via router.getAmountsOut */
export async function getSwapQuote(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  decimalsIn?: number;
  decimalsOut?: number;
  slippage?: number; // e.g. 0.5 for 0.5%
}): Promise<SwapQuote | null> {
  if (!AMM_ROUTER) return null;
  try {
    const router = getRouter();
    const amountInWei = ethers.parseUnits(params.amountIn, params.decimalsIn || 18);
    const path = [params.tokenIn, params.tokenOut];

    const amounts: bigint[] = await router.getAmountsOut(amountInWei, path);
    const amountOut = amounts[amounts.length - 1];
    const amountOutFormatted = ethers.formatUnits(amountOut, params.decimalsOut || 18);

    // Calculate price impact using reserves
    const factory = getFactory();
    const pairAddress = await factory.getPair(params.tokenIn, params.tokenOut);
    let priceImpact = 0;
    if (pairAddress !== ethers.ZeroAddress) {
      const pair = getPairContract(pairAddress);
      const [r0, r1] = await pair.getReserves();
      const token0 = await pair.token0();
      const reserveIn = token0.toLowerCase() === params.tokenIn.toLowerCase() ? r0 : r1;
      priceImpact = Number(amountInWei) / Number(reserveIn) * 100;
    }

    const slippage = params.slippage || 0.5;
    const minOut = amountOut - (amountOut * BigInt(Math.floor(slippage * 100))) / BigInt(10000);

    return {
      amountIn: params.amountIn,
      amountOut: amountOutFormatted,
      path,
      priceImpact: Math.min(priceImpact, 99.99),
      executionPrice: (parseFloat(amountOutFormatted) / parseFloat(params.amountIn)).toFixed(6),
      minimumReceived: ethers.formatUnits(minOut, params.decimalsOut || 18),
    };
  } catch (err) {
    console.error("getSwapQuote error:", err);
    return null;
  }
}

/** Get all pools from factory */
export async function getAllPools(userAddress?: string): Promise<Pool[]> {
  if (!AMM_FACTORY) return [];
  try {
    const factory = getFactory();
    const provider = getProvider();
    const pairsLength = await factory.allPairsLength();
    const pools: Pool[] = [];

    for (let i = 0; i < Number(pairsLength); i++) {
      try {
        const pairAddress = await factory.allPairs(i);
        const pair = getPairContract(pairAddress, provider);

        const [token0Addr, token1Addr, reserves, totalSupply] = await Promise.all([
          pair.token0(),
          pair.token1(),
          pair.getReserves(),
          pair.totalSupply(),
        ]);

        const [t0, t1] = await Promise.all([
          getTokenInfo(token0Addr, provider),
          getTokenInfo(token1Addr, provider),
        ]);

        let userLiquidity = "0";
        let userShare = "0";
        if (userAddress) {
          const bal = await pair.balanceOf(userAddress);
          userLiquidity = ethers.formatUnits(bal, 18);
          if (totalSupply > 0n) {
            userShare = ((Number(bal) / Number(totalSupply)) * 100).toFixed(4);
          }
        }

        pools.push({
          pairAddress,
          token0: t0,
          token1: t1,
          reserve0: ethers.formatUnits(reserves[0], t0.decimals),
          reserve1: ethers.formatUnits(reserves[1], t1.decimals),
          totalSupply: ethers.formatUnits(totalSupply, 18),
          userLiquidity,
          userShare,
        });
      } catch (pairErr) {
        console.warn(`Failed to read pair ${i}:`, pairErr);
      }
    }
    return pools;
  } catch (err) {
    console.error("getAllPools error:", err);
    return [];
  }
}

/** Get token info from contract */
async function getTokenInfo(address: string, provider: ethers.Provider): Promise<PushChainToken> {
  try {
    const token = new ethers.Contract(address, ERC20_ABI, provider);
    const [name, symbol, decimals] = await Promise.all([
      token.name(),
      token.symbol(),
      token.decimals(),
    ]);
    return { address, name, symbol, decimals: Number(decimals) };
  } catch {
    return { address, name: "Unknown", symbol: "???", decimals: 18 };
  }
}

/** Get pair reserves for a token pair */
export async function getPairReserves(tokenA: string, tokenB: string): Promise<{
  reserve0: string; reserve1: string; token0: string; pairAddress: string;
} | null> {
  if (!AMM_FACTORY) return null;
  try {
    const factory = getFactory();
    const pairAddress = await factory.getPair(tokenA, tokenB);
    if (pairAddress === ethers.ZeroAddress) return null;

    const pair = getPairContract(pairAddress);
    const [reserves, token0] = await Promise.all([
      pair.getReserves(),
      pair.token0(),
    ]);

    return {
      reserve0: reserves[0].toString(),
      reserve1: reserves[1].toString(),
      token0,
      pairAddress,
    };
  } catch (err) {
    console.error("getPairReserves error:", err);
    return null;
  }
}

// ============================================
// Write Functions (need signer)
// ============================================

/** Get ethers signer from browser wallet */
async function getSigner(): Promise<ethers.Signer | null> {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const provider = new ethers.BrowserProvider(window.ethereum);
  return provider.getSigner();
}

/** Approve token spending */
export async function approveToken(tokenAddress: string, spenderAddress: string, amount: string, decimals = 18): Promise<string | null> {
  try {
    const signer = await getSigner();
    if (!signer) throw new Error("No signer");

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const amountWei = ethers.parseUnits(amount, decimals);
    const tx = await token.approve(spenderAddress, amountWei);
    await tx.wait();
    return tx.hash;
  } catch (err) {
    console.error("approveToken error:", err);
    return null;
  }
}

/** Execute a swap */
export async function executeSwap(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOutMin: string;
  decimalsIn?: number;
  decimalsOut?: number;
  recipient: string;
  deadline?: number;
  pushChainClient?: any;
}): Promise<{ txHash: string; success: boolean }> {
  try {
    const signer = await getSigner();
    if (!signer) throw new Error("No signer available");

    const router = getRouter(signer);
    const amountInWei = ethers.parseUnits(params.amountIn, params.decimalsIn || 18);
    const amountOutMinWei = ethers.parseUnits(params.amountOutMin, params.decimalsOut || 18);
    const deadline = params.deadline || Math.floor(Date.now() / 1000) + 1200; // 20 min
    const path = [params.tokenIn, params.tokenOut];

    // Approve router to spend tokenIn
    await approveToken(params.tokenIn, AMM_ROUTER, params.amountIn, params.decimalsIn);

    // Execute swap
    const isNativeIn = params.tokenIn === ethers.ZeroAddress || params.tokenIn === WETH_ADDRESS;
    let tx;

    if (isNativeIn) {
      tx = await router.swapExactETHForTokens(
        amountOutMinWei, path, params.recipient, deadline,
        { value: amountInWei }
      );
    } else if (params.tokenOut === ethers.ZeroAddress || params.tokenOut === WETH_ADDRESS) {
      tx = await router.swapExactTokensForETH(
        amountInWei, amountOutMinWei, path, params.recipient, deadline
      );
    } else {
      tx = await router.swapExactTokensForTokens(
        amountInWei, amountOutMinWei, path, params.recipient, deadline
      );
    }

    const receipt = await tx.wait();
    return { txHash: receipt.hash, success: true };
  } catch (err) {
    console.error("executeSwap error:", err);
    return { txHash: "", success: false };
  }
}

/** Add liquidity to a pair */
export async function addLiquidity(params: {
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  decimalsA?: number;
  decimalsB?: number;
  slippage?: number;
  recipient: string;
}): Promise<{ txHash: string; success: boolean; liquidity?: string }> {
  try {
    const signer = await getSigner();
    if (!signer) throw new Error("No signer");

    const router = getRouter(signer);
    const amountAWei = ethers.parseUnits(params.amountA, params.decimalsA || 18);
    const amountBWei = ethers.parseUnits(params.amountB, params.decimalsB || 18);
    const slippage = params.slippage || 1; // 1%
    const amountAMin = amountAWei - (amountAWei * BigInt(Math.floor(slippage * 100))) / BigInt(10000);
    const amountBMin = amountBWei - (amountBWei * BigInt(Math.floor(slippage * 100))) / BigInt(10000);
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    // Approve both tokens
    await approveToken(params.tokenA, AMM_ROUTER, params.amountA, params.decimalsA);
    await approveToken(params.tokenB, AMM_ROUTER, params.amountB, params.decimalsB);

    const tx = await router.addLiquidity(
      params.tokenA, params.tokenB,
      amountAWei, amountBWei,
      amountAMin, amountBMin,
      params.recipient,
      deadline
    );

    const receipt = await tx.wait();
    return { txHash: receipt.hash, success: true };
  } catch (err) {
    console.error("addLiquidity error:", err);
    return { txHash: "", success: false };
  }
}

/** Remove liquidity from a pair */
export async function removeLiquidity(params: {
  tokenA: string;
  tokenB: string;
  liquidity: string;
  slippage?: number;
  recipient: string;
}): Promise<{ txHash: string; success: boolean }> {
  try {
    const signer = await getSigner();
    if (!signer) throw new Error("No signer");

    const router = getRouter(signer);
    const factory = getFactory();
    const pairAddress = await factory.getPair(params.tokenA, params.tokenB);
    if (pairAddress === ethers.ZeroAddress) throw new Error("Pair not found");

    const liquidityWei = ethers.parseUnits(params.liquidity, 18);
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    // Approve pair LP token
    await approveToken(pairAddress, AMM_ROUTER, params.liquidity, 18);

    const tx = await router.removeLiquidity(
      params.tokenA, params.tokenB,
      liquidityWei,
      0, 0, // amountAMin, amountBMin (set to 0 for simplicity — add slippage in production)
      params.recipient,
      deadline
    );

    const receipt = await tx.wait();
    return { txHash: receipt.hash, success: true };
  } catch (err) {
    console.error("removeLiquidity error:", err);
    return { txHash: "", success: false };
  }
}

// Default tokens on PushChain testnet
export const PUSHCHAIN_TOKENS: PushChainToken[] = [
  { address: "0x0000000000000000000000000000000000000000", symbol: "PC", name: "Push Chain", decimals: 18, logoURI: "/profile/profile-logo.png" },
];
