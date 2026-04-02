/**
 * PushChain AMM Contract Addresses & Token Registry
 * Deployed on Push Chain Donut Testnet
 * Source: https://push.org/docs/chain/setup/smart-contract-address-book/
 */

// ═══ CORE AMM CONTRACTS ═══
export const CONTRACTS = {
  FACTORY: "0x81b8Bca02580C7d6b636051FDb7baAC436bFb454",
  SWAP_ROUTER: "0x5D548bB9E305AAe0d6dc6e6fdc3ab419f6aC0037",
  QUOTER_V2: "0x83316275f7C2F79BC4E26f089333e88E89093037",
  POSITION_MANAGER: "0xf9b3ac66aed14A2C7D9AA7696841aB6B27a6231e",
  TICK_LENS: "0xb64113Fc16055AfE606f25658812EE245Aa41dDC",
  MULTICALL: "0xa8c00017955c8654bfFbb6d5179c99f5aB8B7849",
  WPC: "0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9", // Wrapped Push Chain (like WETH)
} as const;

// ═══ PRC-20 TOKENS ON PUSH CHAIN ═══
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  sourceChain: string;
  logoURI: string;
  swappable?: boolean;
}

export const TOKENS: TokenInfo[] = [
  // Native / Wrapped
  { address: "0x0000000000000000000000000000000000000000", symbol: "PC", name: "Push Chain", decimals: 18, sourceChain: "Push Chain", logoURI: "/profile/profile-logo.png", swappable: true },
  { address: CONTRACTS.WPC, symbol: "WPC", name: "Wrapped Push Chain", decimals: 18, sourceChain: "Push Chain", logoURI: "/profile/profile-logo.png", swappable: true },

  // Ethereum Sepolia
  { address: "0x2971824Db68229D087931155C2b8bB820B275809", symbol: "pETH", name: "pETH", decimals: 18, sourceChain: "Ethereum", logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", swappable: true },
  { address: "0x0d0dF7E8807430A81104EA84d926139816eC7586", symbol: "WETH.eth", name: "Wrapped ETH (Ethereum)", decimals: 18, sourceChain: "Ethereum", logoURI: "https://assets.coingecko.com/coins/images/2518/small/weth.png", swappable: false },
  { address: "0xCA0C5E6F002A389E1580F0DB7cd06e4549B5F9d3", symbol: "USDT.eth", name: "Tether (Ethereum)", decimals: 6, sourceChain: "Ethereum", logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png", swappable: true },
  { address: "0xaf89E805949c628ebde3262e91dc4ab9eA12668E", symbol: "stETH.eth", name: "Lido stETH (Ethereum)", decimals: 18, sourceChain: "Ethereum", logoURI: "https://assets.coingecko.com/coins/images/13442/small/steth_logo.png", swappable: false },
  { address: "0x387b9C8Db60E74999aAAC5A2b7825b400F12d68E", symbol: "USDC.eth", name: "USD Coin (Ethereum)", decimals: 6, sourceChain: "Ethereum", logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png", swappable: true },

  // Solana Devnet
  { address: "0x5D525Df2bD99a6e7ec58b76aF2fd95F39874EBed", symbol: "pSOL", name: "pSOL", decimals: 9, sourceChain: "Solana", logoURI: "https://assets.coingecko.com/coins/images/4128/small/solana.png", swappable: true },
  { address: "0x04B8F634ABC7C879763F623e0f0550a4b5c4426F", symbol: "USDC.sol", name: "USD Coin (Solana)", decimals: 6, sourceChain: "Solana", logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png", swappable: false },
  { address: "0x4f1A3D22d170a2F4Bddb37845a962322e24f4e34", symbol: "USDT.sol", name: "Tether (Solana)", decimals: 6, sourceChain: "Solana", logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png", swappable: false },
  { address: "0x5861f56A556c990358cc9cccd8B5baa3767982A8", symbol: "DAI.sol", name: "DAI (Solana)", decimals: 18, sourceChain: "Solana", logoURI: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png", swappable: false },

  // Base Sepolia
  { address: "0xc7007af2B24D4eb963fc9633B0c66e1d2D90Fc21", symbol: "pETH.base", name: "pETH (Base)", decimals: 18, sourceChain: "Base", logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", swappable: true },
  { address: "0x2C455189D2af6643B924A981a9080CcC63d5a567", symbol: "USDT.base", name: "Tether (Base)", decimals: 6, sourceChain: "Base", logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png", swappable: true },
  { address: "0x84B62e44F667F692F7739Ca6040cD17DA02068A8", symbol: "USDC.base", name: "USD Coin (Base)", decimals: 6, sourceChain: "Base", logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png", swappable: true },

  // Arbitrum Sepolia
  { address: "0xc0a821a1AfEd1322c5e15f1F4586C0B8cE65400e", symbol: "pETH.arb", name: "pETH (Arbitrum)", decimals: 18, sourceChain: "Arbitrum", logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", swappable: true },
  { address: "0xa261A10e94aE4bA88EE8c5845CbE7266bD679DD6", symbol: "USDC.arb", name: "USD Coin (Arbitrum)", decimals: 6, sourceChain: "Arbitrum", logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png", swappable: true },
  { address: "0x76Ad08339dF606BeEDe06f90e3FaF82c5b2fb2E9", symbol: "USDT.arb", name: "Tether (Arbitrum)", decimals: 6, sourceChain: "Arbitrum", logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png", swappable: true },

  // BNB Testnet
  { address: "0x2f98B4235FD2BA0173a2B056D722879360B12E7b", symbol: "USDT.bnb", name: "Tether (BNB)", decimals: 6, sourceChain: "BNB Chain", logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png", swappable: true },
  { address: "0x7a9082dA308f3fa005beA7dB0d203b3b86664E36", symbol: "pBNB", name: "pBNB", decimals: 18, sourceChain: "BNB Chain", logoURI: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png", swappable: true },
];

// ═══ LIVE AMM POOLS ═══
export interface PoolInfo {
  address: string;
  token0: string;
  token1: string;
  fee: number;
  name: string;
}

export const POOLS: PoolInfo[] = [
  { address: "0x0E5914e3A7e2e6d18330Dd33fA387Ce33Da48b54", token0: "0x5D525Df2bD99a6e7ec58b76aF2fd95F39874EBed", token1: CONTRACTS.WPC, fee: 500, name: "pSOL/WPC" },
  { address: "0x012d5C099f8AE00009f40824317a18c3A342f622", token0: "0x2971824Db68229D087931155C2b8bB820B275809", token1: CONTRACTS.WPC, fee: 500, name: "pETH/WPC" },
  { address: "0x2d46b2b92266f34345934F17039768cd631aB026", token0: "0xCA0C5E6F002A389E1580F0DB7cd06e4549B5F9d3", token1: CONTRACTS.WPC, fee: 500, name: "USDT.eth/WPC" },
  { address: "0x69B21660F49f2B8F60B0177Abc751a08EBEa0Ae3", token0: "0x387b9C8Db60E74999aAAC5A2b7825b400F12d68E", token1: CONTRACTS.WPC, fee: 500, name: "USDC.eth/WPC" },
  { address: "0x1cE819E742b44f922D2F05fdFFd17b4997f4CD15", token0: "0x2C455189D2af6643B924A981a9080CcC63d5a567", token1: CONTRACTS.WPC, fee: 500, name: "USDT.base/WPC" },
  { address: "0xF926707689ad2fE9A81e666E5B888b2f3AD33980", token0: "0xc7007af2B24D4eb963fc9633B0c66e1d2D90Fc21", token1: CONTRACTS.WPC, fee: 500, name: "pETH.base/WPC" },
  { address: "0x1354c9A72F447f60F4811FC34b8C2e084FE338A3", token0: "0xc0a821a1AfEd1322c5e15f1F4586C0B8cE65400e", token1: CONTRACTS.WPC, fee: 3000, name: "pETH.arb/WPC" },
  { address: "0xF95B20Cf3f2dE495747EB3d33611D0FFEA29F448", token0: "0x76Ad08339dF606BeEDe06f90e3FaF82c5b2fb2E9", token1: CONTRACTS.WPC, fee: 500, name: "USDT.arb/WPC" },
  { address: "0x435875db8a76cCAA9cbf73690C6Dc1913BBC9168", token0: "0x2f98B4235FD2BA0173a2B056D722879360B12E7b", token1: CONTRACTS.WPC, fee: 500, name: "USDT.bnb/WPC" },
  { address: "0x826edC20c926653f4ddC01b8d4C7Df31a403e7d6", token0: "0x7a9082dA308f3fa005beA7dB0d203b3b86664E36", token1: CONTRACTS.WPC, fee: 500, name: "pBNB/WPC" },
  { address: "0xF3578f9dEE1591a45366801CedF91B4935997964", token0: "0xa261A10e94aE4bA88EE8c5845CbE7266bD679DD6", token1: CONTRACTS.WPC, fee: 500, name: "USDC.arb/WPC" },
  { address: "0x96Ef417eA20114D86C2a60864a63A69344234930", token0: "0x84B62e44F667F692F7739Ca6040cD17DA02068A8", token1: CONTRACTS.WPC, fee: 500, name: "USDC.base/WPC" },
];

// ═══ UNISWAP V3 ABIs (minimal) ═══
export const QUOTER_V2_ABI = [
  "function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
  "function quoteExactOutputSingle(tuple(address tokenIn, address tokenOut, uint256 amount, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
] as const;

export const SWAP_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function exactOutputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountIn)",
  "function multicall(bytes[] data) payable returns (bytes[] results)",
] as const;

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
] as const;

export const POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
] as const;

// ═══ NonfungiblePositionManager ABI (Uniswap V3 — add/remove liquidity) ═══
export const POSITION_MANAGER_ABI = [
  // Mint a new liquidity position
  "function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  // Add liquidity to an existing position
  "function increaseLiquidity(tuple(uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)",
  // Remove liquidity from a position
  "function decreaseLiquidity(tuple(uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) returns (uint256 amount0, uint256 amount1)",
  // Collect tokens owed (after decreaseLiquidity or from fees)
  "function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) returns (uint256 amount0, uint256 amount1)",
  // Burn an empty position NFT
  "function burn(uint256 tokenId) external",
  // Read a position
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  // ERC721 NFT functions
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function approve(address to, uint256 tokenId) external",
  // Contract references
  "function factory() view returns (address)",
  "function WETH9() view returns (address)",
  // Multicall for batching
  "function multicall(bytes[] calldata data) payable returns (bytes[] memory results)",
  // Unwrap WETH9 (WPC) to native after collect
  "function unwrapWETH9(uint256 amountMinimum, address recipient) external payable",
  // Sweep leftover tokens
  "function sweepToken(address token, uint256 amountMinimum, address recipient) external payable",
  // Refund leftover ETH
  "function refundETH() external payable",
] as const;

// ═══ WETH9 (WPC) ABI ═══
export const WPC_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 wad) external",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
  "function transfer(address, uint256) returns (bool)",
] as const;

// ═══ Tick math constants ═══
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;
// Common tick spacings by fee tier
export const TICK_SPACINGS: Record<number, number> = {
  100: 1,    // 0.01% fee
  500: 10,   // 0.05% fee
  3000: 60,  // 0.3% fee
  10000: 200, // 1% fee
};

// ═══ HELPERS ═══
export const PUSHCHAIN_RPC = "https://evm.donut.rpc.push.org/";
export const PUSHCHAIN_CHAIN_ID = 2442;
export const PUSHCHAIN_EXPLORER = "https://donut.push.network";

export function getTokenByAddress(address: string): TokenInfo | undefined {
  return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase());
}

export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
  return TOKENS.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
}

export function findPool(tokenA: string, tokenB: string): PoolInfo | undefined {
  const a = tokenA.toLowerCase();
  const b = tokenB.toLowerCase();
  return POOLS.find(p =>
    (p.token0.toLowerCase() === a && p.token1.toLowerCase() === b) ||
    (p.token0.toLowerCase() === b && p.token1.toLowerCase() === a)
  );
}

export function getSwappableTokens(): TokenInfo[] {
  return TOKENS.filter(t => t.swappable !== false);
}
