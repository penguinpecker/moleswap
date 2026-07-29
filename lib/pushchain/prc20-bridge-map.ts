/**
 * PRC-20 ↔ Origin Chain Bridge Map
 * ─────────────────────────────────────────────────────────────────────────
 * Maps each Push Chain PRC-20 (synthetic token) to its origin-chain asset.
 *
 * When a user's wallet origin matches a token's origin chain, we can inject
 * `funds: { amount, token }` into the swap's first step — the SDK will then
 * auto-bridge the origin asset into the user's UEA as part of the same tx.
 *
 * This is how RamenFi achieves the "connect Phantom, swap SOL directly" UX:
 * instead of requiring the user to pre-bridge SOL → pSOL, the swap's first
 * step carries `funds: { token: MOVEABLE.TOKEN.SOLANA_DEVNET.SOL }` and the
 * SDK handles both the lock-on-Solana and mint-on-Push atomically.
 *
 * The values in this map come directly from @pushchain/core's
 * `PushChain.utils.tokens.getPRC20Address()`. DO NOT guess these — they are
 * deterministic derivations from the origin chain + origin token address
 * registered in the SDK. Adding a token here only works if the SDK itself
 * recognizes the mapping.
 *
 * Re-verify this map whenever @pushchain/core is upgraded — Push does re-deploy
 * these testnet contracts across minor versions. The two files to diff are:
 *   node_modules/@pushchain/core/src/lib/constants/tokens.js  (origin tokens,
 *     via MOVEABLE_TOKENS / the MoveableTokenAccessor getters)
 *   node_modules/@pushchain/core/src/lib/constants/chain.js   (PRC-20 addresses,
 *     via SYNTHETIC_PUSH_ERC20[PUSH_NETWORK.TESTNET_DONUT])
 * A symbol that the accessor doesn't expose for a chain throws rather than
 * returning undefined, so a renamed symbol shows up as a silently-null bridge.
 */

export interface Prc20BridgeInfo {
  /** Push Chain PRC-20 address (checksummed) */
  prc20Address: `0x${string}`;
  /** CAIP-style origin chain identifier, e.g. "eip155:11155111" or "solana:EtWTRAB..." */
  originChain: string;
  /** SDK constant name, e.g. "ETHEREUM_SEPOLIA", used as a lookup key into MOVEABLE.TOKEN */
  originChainSdkName: "ETHEREUM_SEPOLIA" | "ARBITRUM_SEPOLIA" | "BASE_SEPOLIA" | "BNB_TESTNET" | "SOLANA_DEVNET";
  /**
   * Canonical token symbol on the origin chain, e.g. "ETH", "USDT", "SOL" — used
   * as the key into MOVEABLE.TOKEN.{CHAIN}. Must be a symbol the SDK actually
   * exposes for that chain: the accessor throws on unknown symbols, e.g.
   * BNB_TESTNET exposes BNB/USDT/USDC but NOT ETH (see the BNB note below).
   */
  originSymbol: "ETH" | "BNB" | "SOL" | "USDT" | "USDC" | "WETH" | "stETH" | "DAI";
  /** Number of decimals on the origin chain (may differ from PRC-20 decimals) */
  originDecimals: number;
  /** Origin address — for native tokens this is `0x0000...0000`, for ERC-20 it's the contract, for SPL it's the mint string */
  originAddress: string;
  /** How the Universal Gateway moves the asset: 'native' for ETH/SOL, 'approve' for ERC-20/SPL */
  mechanism: "approve" | "permit2" | "native";
  /** Human label for the UI selector (e.g. "Ethereum", "Solana") */
  uiLabel: string;
}

/**
 * Keyed by PRC-20 address (always lowercased for O(1) lookup).
 * Origin-chain data verified against @pushchain/core v6.0.20 SDK constants.
 *
 * MIGRATED for 6.0.20 (2026-07-29): Push re-deployed their testnet stables in
 * 6.0.x, moving BOTH the origin-chain token and its Push Chain PRC-20. Because
 * getSdkMoveableToken() resolves `funds.token` by (chain, symbol) against the
 * LIVE SDK constants, leaving the 5.1.x PRC-20s keyed here would mint the 6.0.x
 * token into the UEA while the swap leg still spent the 5.1.x one. Both sides
 * were moved together — keys here, and TOKENS/POOLS in ./contracts:
 *
 *              origin token                    PRC-20 key
 *   USDT.eth   0xC4230aEa… (was 0x7169D388…)   0x0f97A213… (was 0xCA0C5E6F…)
 *   USDT.arb   0xE3092852… (was 0x1419d7C7…)   0xFE6E9DF2… (was 0x76Ad0833…)
 *   USDT.base  0x4D7646B9… (was 0x9FF5a186…)   0x14882380… (was 0x2C455189…)
 *   USDT.bnb   0xE935d9c9… (was 0xBC14F348…)   0x731aF1Da… (was 0x2f98B423…)
 *
 * Native assets needed no change: pETH / pETH.arb / pETH.base / pSOL / pBNB and
 * both Solana PRC-20s (USDT.sol, USDC.sol) kept their addresses across 6.0.x.
 */
export const PRC20_BRIDGE_MAP: Record<string, Prc20BridgeInfo> = {
  // ─── Ethereum Sepolia ─────────────────────────────────────────────────
  "0x2971824db68229d087931155c2b8bb820b275809": {
    prc20Address: "0x2971824Db68229D087931155C2b8bB820B275809",
    originChain: "eip155:11155111",
    originChainSdkName: "ETHEREUM_SEPOLIA",
    originSymbol: "ETH",
    originDecimals: 18,
    originAddress: "0x0000000000000000000000000000000000000000",
    mechanism: "native",
    uiLabel: "Ethereum",
  },
  "0x0f97a213207703923f5f0c613c9827f7c9a0f96b": {
    prc20Address: "0x0f97A213207703923F5f0C613C9827f7C9A0f96B",
    originChain: "eip155:11155111",
    originChainSdkName: "ETHEREUM_SEPOLIA",
    originSymbol: "USDT",
    originDecimals: 6,
    // Re-deployed by Push in SDK 6.0.2 (was 0x7169D388…0BA06 through 5.1.x).
    originAddress: "0xC4230aEaFcF6b8B49a7b4e53886420f00ff71876",
    mechanism: "approve",
    uiLabel: "Ethereum",
  },

  // ─── Arbitrum Sepolia ─────────────────────────────────────────────────
  "0xc0a821a1afed1322c5e15f1f4586c0b8ce65400e": {
    prc20Address: "0xc0a821a1AfEd1322c5e15f1F4586C0B8cE65400e",
    originChain: "eip155:421614",
    originChainSdkName: "ARBITRUM_SEPOLIA",
    originSymbol: "ETH",
    originDecimals: 18,
    originAddress: "0x0000000000000000000000000000000000000000",
    mechanism: "native",
    uiLabel: "Arbitrum",
  },
  "0xfe6e9df2bbc9ce05d98b83b1365df6dca9951891": {
    prc20Address: "0xFE6E9DF2BbC9ce05D98b83B1365df6DcA9951891",
    originChain: "eip155:421614",
    originChainSdkName: "ARBITRUM_SEPOLIA",
    originSymbol: "USDT",
    originDecimals: 6,
    // Re-deployed by Push in SDK 6.0.2 (was 0x1419d7C7…22f0 through 5.1.x).
    originAddress: "0xE30928528f52CAEeB75fB07837e22d77D47e9c07",
    mechanism: "approve",
    uiLabel: "Arbitrum",
  },

  // ─── Base Sepolia ─────────────────────────────────────────────────────
  "0xc7007af2b24d4eb963fc9633b0c66e1d2d90fc21": {
    prc20Address: "0xc7007af2B24D4eb963fc9633B0c66e1d2D90Fc21",
    originChain: "eip155:84532",
    originChainSdkName: "BASE_SEPOLIA",
    originSymbol: "ETH",
    originDecimals: 18,
    originAddress: "0x0000000000000000000000000000000000000000",
    mechanism: "native",
    uiLabel: "Base",
  },
  "0x148823809b853e1db187bc09a9ac909bc42f971a": {
    prc20Address: "0x148823809B853e1db187BC09A9ac909BC42F971a",
    originChain: "eip155:84532",
    originChainSdkName: "BASE_SEPOLIA",
    originSymbol: "USDT",
    originDecimals: 6,
    // Re-deployed by Push in SDK 6.0.2 (was 0x9FF5a186…E0cB through 5.1.x).
    originAddress: "0x4D7646B9eE3D68F4b0F135B5cbc66B00819F6b61",
    mechanism: "approve",
    uiLabel: "Base",
  },

  // ─── BNB Testnet ──────────────────────────────────────────────────────
  // The token at 0x7a9082dA… was `pETH_BNB` in SDK 5.1.x, which is why it was
  // long treated as "ETH bridged from BNB Chain". SDK 6.0.0 renamed it to
  // `pBNB` and dropped the ETH accessor from BNB_TESTNET entirely — the chain
  // now exposes BNB/USDT/USDC. On-chain `symbol()` returns "pBNB", so the v6
  // naming is the accurate one: this really is native BNB.
  //
  // originSymbol MUST be "BNB" here: `MOVEABLE.TOKEN.BNB_TESTNET.ETH` throws
  // under 6.x, which getSdkMoveableToken swallows into a null — silently
  // disabling the bridge instead of bridging the wrong asset.
  "0x7a9082da308f3fa005bea7db0d203b3b86664e36": {
    prc20Address: "0x7a9082dA308f3fa005beA7dB0d203b3b86664E36",
    originChain: "eip155:97",
    originChainSdkName: "BNB_TESTNET",
    originSymbol: "BNB",
    originDecimals: 18,
    originAddress: "0x0000000000000000000000000000000000000000",
    mechanism: "native",
    uiLabel: "BNB Chain",
  },
  "0x731af1da5365259d27528557ee4afba4bac90ef2": {
    prc20Address: "0x731aF1Da5365259d27528557EE4aFBA4baC90ef2",
    originChain: "eip155:97",
    originChainSdkName: "BNB_TESTNET",
    originSymbol: "USDT",
    originDecimals: 6,
    // Re-deployed by Push in SDK 6.0.2 (was 0xBC14F348…3DC5 through 5.1.x).
    originAddress: "0xE935d9c9C24D02E61186c640cc01d713C876d40F",
    mechanism: "approve",
    uiLabel: "BNB Chain",
  },

  // ─── Solana Devnet ────────────────────────────────────────────────────
  "0x5d525df2bd99a6e7ec58b76af2fd95f39874ebed": {
    prc20Address: "0x5D525Df2bD99a6e7ec58b76aF2fd95F39874EBed",
    originChain: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    originChainSdkName: "SOLANA_DEVNET",
    originSymbol: "SOL",
    originDecimals: 9,
    originAddress: "0x0000000000000000000000000000000000000000",
    mechanism: "native",
    uiLabel: "Solana",
  },
  "0x4f1a3d22d170a2f4bddb37845a962322e24f4e34": {
    prc20Address: "0x4f1A3D22d170a2F4Bddb37845a962322e24f4e34",
    originChain: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    originChainSdkName: "SOLANA_DEVNET",
    originSymbol: "USDT",
    originDecimals: 6,
    originAddress: "EiXDnrAg9ea2Q6vEPV7E5TpTU1vh41jcuZqKjU5Dc4ZF",
    mechanism: "approve",
    uiLabel: "Solana",
  },
};

/**
 * Look up bridge info for a PRC-20 address. Returns null if the token isn't
 * officially bridge-able via Push Chain's Universal Gateway yet.
 *
 * As of v6.0.20 the SDK does expose USDC (plus WETH, stETH and a Solana DAI)
 * as moveable tokens on every supported chain, so the old "USDC has no mapping"
 * limitation is gone — but MoleSwap has no USDC entries here yet, so USDC still
 * resolves to null and stays non-bridgeable in the UI.
 */
export function getBridgeInfoForPrc20(prc20Address: string): Prc20BridgeInfo | null {
  if (!prc20Address) return null;
  const key = prc20Address.toLowerCase();
  return PRC20_BRIDGE_MAP[key] || null;
}

/**
 * Does the user's connected origin chain match this PRC-20's origin chain?
 * If yes, we can inject `funds: { token: MOVEABLE.TOKEN.X.Y }` and the SDK
 * will auto-bridge the origin asset as part of the swap (1-sig cross-chain
 * swap from any supported wallet).
 *
 * Example: user is on Phantom (origin=Solana), selects pSOL as fromToken.
 *   → bridge.originChain === user's originChain → YES, inject funds for SOL
 *
 * Example: user is on MetaMask Sepolia (origin=eip155:11155111), selects pSOL.
 *   → bridge.originChain (Solana) !== user's originChain (Sepolia) → NO,
 *     user must already hold pSOL on Push Chain; direct swap works
 *     (they'd have bridged earlier via a separate funds-only tx).
 */
export function canAutoBridgeFrom(
  prc20Address: string,
  userOriginChain: string | null | undefined,
): boolean {
  if (!userOriginChain) return false;
  const bridge = getBridgeInfoForPrc20(prc20Address);
  if (!bridge) return false;
  return bridge.originChain.toLowerCase() === userOriginChain.toLowerCase();
}

/**
 * Resolve the SDK's MOVEABLE.TOKEN constant for a given PRC-20, if we have it.
 * The caller passes `PushChain.CONSTANTS.MOVEABLE.TOKEN` since we can't
 * import @pushchain/core at module-load time from some bundlers.
 *
 * Returns the actual MoveableToken object (with { symbol, decimals, address,
 * mechanism }) that the SDK's sendTransaction expects under `funds.token`.
 */
export function getSdkMoveableToken(
  prc20Address: string,
  moveableTokenConstants: any,
): any | null {
  const bridge = getBridgeInfoForPrc20(prc20Address);
  if (!bridge) return null;
  try {
    const chainAccessor = moveableTokenConstants?.[bridge.originChainSdkName];
    if (!chainAccessor) return null;
    return chainAccessor[bridge.originSymbol] || null;
  } catch {
    return null;
  }
}
