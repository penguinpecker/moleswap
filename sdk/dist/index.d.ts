/**
 * MoleSwap SDK
 * TypeScript SDK for integrating with MoleSwap DEX on PushChain
 *
 * Usage:
 *   import { MoleSwap } from "@moleswap/sdk";
 *   const mole = new MoleSwap();
 *   const quote = await mole.getQuote({ ... });
 *
 * Or with a custom base URL:
 *   const mole = new MoleSwap("https://your-deployment.vercel.app");
 */
export interface MoleSwapConfig {
    baseUrl?: string;
    timeout?: number;
}
export interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    sourceChain: string;
    logoURI: string;
    isNative?: boolean;
    isWrappedNative?: boolean;
}
export interface PoolInfo {
    address: string;
    name: string;
    fee: number;
    feeTier: string;
    token0: {
        address: string;
        symbol: string;
        name: string;
        decimals: number;
        poolBalance?: string;
    };
    token1: {
        address: string;
        symbol: string;
        name: string;
        decimals: number;
        poolBalance?: string;
    };
    sqrtPriceX96: string;
    tick: number;
    liquidity: string;
    hasLiquidity: boolean;
    price: number;
}
export interface QuoteResult {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    amountOutFormatted?: string;
    fee: number;
    feeTier?: string;
    pool?: string;
    type: "direct" | "multi_hop" | "wrap_unwrap";
    effectivePrice?: number;
    gasEstimate: string;
    route: string;
    hops?: {
        pool: string;
        fee: number;
    }[];
}
export interface TransactionStep {
    to: string;
    value: string;
    data: string;
    description: string;
    note?: string;
}
export interface TxBuildResult {
    type: string;
    description: string;
    pool?: string | null;
    transactions: TransactionStep[];
    chainId: number;
    rpc: string;
    note?: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    timestamp: number;
    error?: string;
}
export interface QuoteParams {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    fee?: number;
}
export interface SwapParams {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOutMin?: string;
    recipient: string;
    fee?: number;
    slippageBps?: number;
    deadline?: number;
}
export interface CreatePoolParams {
    tokenA: string;
    tokenB: string;
    fee?: number;
    initialPrice?: number;
    amount0Desired?: string;
    amount1Desired?: string;
    recipient: string;
    tickLower?: number;
    tickUpper?: number;
    slippageBps?: number;
    deadline?: number;
}
export interface AddLiquidityParams {
    token0: string;
    token1: string;
    fee?: number;
    amount0Desired: string;
    amount1Desired: string;
    recipient: string;
    tickLower?: number;
    tickUpper?: number;
    slippageBps?: number;
    deadline?: number;
}
export declare const CONTRACTS: {
    readonly FACTORY: "0x81b8Bca02580C7d6b636051FDb7baAC436bFb454";
    readonly SWAP_ROUTER: "0x5D548bB9E305AAe0d6dc6e6fdc3ab419f6aC0037";
    readonly QUOTER_V2: "0x83316275f7C2F79BC4E26f089333e88E89093037";
    readonly POSITION_MANAGER: "0xf9b3ac66aed14A2C7D9AA7696841aB6B27a6231e";
    readonly WPC: "0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9";
};
export declare const PUSHCHAIN_RPC = "https://evm.donut.rpc.push.org/";
export declare const PUSHCHAIN_CHAIN_ID = 2442;
export declare const PUSHCHAIN_EXPLORER = "https://donut.push.network";
export declare class MoleSwap {
    private baseUrl;
    private timeout;
    constructor(config?: string | MoleSwapConfig);
    private request;
    getTokens(filters?: {
        chain?: string;
        search?: string;
    }): Promise<{
        count: number;
        tokens: TokenInfo[];
        contracts: typeof CONTRACTS;
    }>;
    getPools(includeEmpty?: boolean): Promise<{
        count: number;
        chainId: number;
        rpc: string;
        pools: PoolInfo[];
    }>;
    getPool(address: string): Promise<PoolInfo & {
        explorer: string;
    }>;
    getQuote(params: QuoteParams): Promise<QuoteResult>;
    buildSwapTx(params: SwapParams): Promise<TxBuildResult>;
    buildCreatePoolTx(params: CreatePoolParams): Promise<TxBuildResult>;
    buildAddLiquidityTx(params: AddLiquidityParams): Promise<TxBuildResult>;
    getExplorerUrl(txHash: string): string;
    getAddressUrl(address: string): string;
}
export declare class MoleSwapError extends Error {
    status: number;
    constructor(message: string, status: number);
}
export default MoleSwap;
