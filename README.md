# MoleSwap — Decentralized Swap Game

A pixel-art themed DEX with gamification, powered by **PushChain**.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│   Next.js 15 + Tailwind v4 + ThaleahFat font    │
│   Pixel art assets from Figma                   │
├──────────────┬──────────────┬───────────────────┤
│  PushChain   │   Relay      │    Supabase       │
│  Wallet      │   Protocol   │    Backend        │
│  Provider    │   (AMM/Swap) │    (Auth/Data)    │
│              │              │                   │
│  @pushchain/ │  @relay      │  Leaderboard      │
│  core + ui   │  protocol/   │  Quests           │
│              │  relay-sdk   │  User profiles    │
└──────┬───────┴──────┬───────┴───────────────────┘
       │              │
       ▼              ▼
  PushChain      EVM Chains
  Universal      (ETH, Base,
  Blockchain     Arbitrum...)
```

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **Styling**: Tailwind CSS v4 + custom pixel art theme
- **Fonts**: ThaleahFat (display), PixelifySans (body)
- **Wallet**: PushChain Universal Wallet (`@pushchain/core` + `@pushchain/ui-kit`)
- **Swaps**: PushChain AMM (with Relay Protocol fallback)
- **Backend**: Supabase (auth, leaderboard, quests)
- **Deployment**: Vercel-ready

## Pages

| Route | Description |
|-------|-------------|
| `/dapp` | Exchange — token swap interface (landing page) |
| `/profile` | User profile with wallet, XP, rank |
| `/quests` | Quest board — main, dapp, game quests |
| `/leaderboard` | Global rankings |
| `/daily` | Daily spin wheel |
| `/mole-whack` | Whack-a-mole mini game |
| `/diamond-miner` | Diamond mining game |
| `/earn-xp` | XP earning activities |

## Getting Started

```bash
# Install
npm install

# Create env file
cp .env.example .env.local
# Fill in your Supabase + PushChain values

# Dev
npm run dev

# Build
npm run build

# Start
npm start
```

## PushChain Integration

The wallet integration lives in `lib/pushchain/`:

- **`provider.tsx`** — React context wrapping PushChain Universal Wallet
- **`amm.ts`** — Swap quote + execution via PushChain AMM
- **`index.ts`** — Public exports

When `@pushchain/core` is installed, uncomment the SDK calls in `provider.tsx` to enable:
- Universal wallet creation (any chain → PushChain)
- Cross-chain transactions via `pushChainClient.universal.sendTransaction`
- Native PushChain AMM pool swaps

Until then, the app falls back to MetaMask + Relay Protocol for liquidity.

## Modifying for PushChain AMM

When PushChain AMM contracts are deployed:

1. Update `lib/pushchain/amm.ts` with AMM contract addresses
2. Replace Relay `getQuote` with on-chain AMM `getAmountsOut`
3. Replace Relay `execute` with PushChain universal transactions
4. The UI remains exactly the same — only the backend changes

## Solana → Push Swap Dispatch — Known-Good Path & Pitfalls

**TL;DR — for Solana-origin swaps, use the sequential (multi-sig) path. The 1-sig BridgeHelper path does NOT work through the Push Solana gateway today.** If a future change appears to enable it, don't ship until end-to-end verified from Phantom.

### The working path (shipped)

For any swap where the user is on Solana (Phantom) and the destination is on Push Chain, `lib/pushchain/amm.ts → executeStepsSequential` fires **one `universal.sendTransaction` per step**:

1. `{ to: userUEA, funds }` — gateway's "mint bridged tokens to user's UEA" instruction.
2. *(optional approve)* `{ to: token, data: approve(...) }` — approve FeeRouter/SwapRouter.
3. `{ to: FeeRouter, data: swap(...) }` — actual swap, possibly unwrapping WPC → native PC at the end.

Each tx is its own Solana transaction, each fits under Solana's 1232-byte limit, and each uses a gateway dispatch mode the Push SVM relay actually recognizes. User signs 2–3 times but every signature lands.

Confirmed working: `0xfe6a2dcb3a65b5f0e62bd5ead0ae87f2a0cf09b1fd7c415d279e4c78dfea131c` (0.01 SOL → native PC, 2026-04-20).

### The broken 1-sig path — DO NOT RE-ENABLE WITHOUT COORDINATION

`MoleSwapBridgeHelper` (deployed at `0x7db2Bdc454C62354C660a673B317D6945065cd0c`) is an on-chain contract that bundles wrap + approve + swap into a single function call, mirroring RamenFi's `depositPRC20WithAutoSwap` (selector `0x780ad827`). The contract itself is fine: all four selectors are present in bytecode and `staticcall` returns the expected `"INSUFFICIENT_BRIDGED_AMOUNT"` revert.

The problem is **dispatch** — when the SDK tries to deliver funds + calldata to a custom helper through Push's Solana gateway, Phantom's `signAndSendTransaction` aborts with the opaque `"Me: Unexpected error"`. We tried both plausible envelopes:

| # | Call shape | Result |
|---|---|---|
| 1 | `{ to: HELPER_ADDR, funds, data: helperCalldata }` | ❌ Phantom `"Me: Unexpected error"` |
| 2 | `{ to: MULTICALL_TARGET_ADDRESS (0x0), funds, data: [{ to: HELPER_ADDR, value: 0, data: helperCalldata }] }` | ❌ Phantom `"Me: Unexpected error"` |

Both modes fail identically. The Push SVM gateway's Solana-side relay appears to route inbound txs only through a closed set of pre-registered / whitelisted destinations (FeeRouter, SwapRouter, the multicall target with a restricted set of nested targets). A freshly-deployed third-party helper is not in that set, regardless of how we wrap the call.

The helper code is still in `lib/pushchain/amm.ts` but gated by an env flag:

```bash
# Do NOT set this in production until Push whitelists the helper.
NEXT_PUBLIC_USE_SOL_HELPER=1
```

With the flag unset (default), `BRIDGE_HELPER_DEPLOYED` resolves to `false`, `useSolanaHelper` short-circuits to `false`, and every Solana-origin swap falls through to `executeStepsSequential`.

### What it would take to get 1-sig back

Not a client-side change. Either:
- Push registers `0x7db2…cd0c` in the Solana gateway's destination allowlist, **or**
- We route through `MULTICALL_TARGET_ADDRESS` but the gateway's nested-call allowlist permits our helper, **or**
- We migrate to whatever mechanism RamenFi uses for `depositPRC20WithAutoSwap` (still an open question — their helper is registered somewhere we don't have visibility into).

Any of these requires the Push team. Until that's in writing, don't flip the flag.

### Regression timeline

Useful for `git bisect` next time something around this path breaks:

| Commit | Change | Solana → PC effect |
|---|---|---|
| `e814587` | Helper contract + helper-dispatch code introduced | Not triggered for token→PC (no `bridgeAndSwapToNative` in decoder) — silently fell back to sequential, so it worked. |
| `a524dca` | Added `swapNativeOutput` (unwraps WPC → native PC) | Still worked — helper decoder didn't know `swapNativeOutput`, so token→PC kept hitting the sequential fallback. |
| `40b85cd` | Wired `swapNativeOutput` to `bridgeAndSwapToNative` in the helper decoder | **Broke.** SOL→PC now took the helper dispatch path, which the gateway can't relay → Phantom "Unexpected error". |
| `7a2308f` | Attempted fix: wrap helper call in single-element multicall | Still broken (same Phantom error). |
| `cad2bd5` | Disabled helper via `NEXT_PUBLIC_USE_SOL_HELPER` flag (default off) | **Fixed.** Back to the sequential path that worked at `a524dca`. |

### Diagnostic lesson (read this before you touch the Solana path)

Initial debugging chased the wrong hypothesis: `"Me: Unexpected error"` looked like a Phantom-on-Mainnet cluster mismatch, and I spent several commits building preflight balance-fingerprinting + actionable error messages around that theory. The fingerprint couldn't even fire reliably (public Mainnet RPC rate-limits browser requests with 403), and the underlying cause was completely different.

**The signal that actually cracked it was the user saying "this used to work 2 commits ago."** That immediately localized the regression to the helper-dispatch change in `40b85cd`, not to anything in Phantom's environment. If you're debugging this path and stuck:

1. **`git bisect` first, hypothesize second.** When a cross-chain signing failure is opaque from the wallet side, regression-bisection on your own dispatch code is more reliable than speculating about the counterparty's state.
2. **Trust "it worked N commits ago."** If a user tells you this, take it literally — check that diff before you form a theory.
3. **Don't over-index on a specific error string.** `"Me: Unexpected error"` has at least three completely different causes (cluster mismatch, insufficient funds, unsupported dispatch target). A one-cause error message steers users wrong for the other two.

Verification scripts for the next debug cycle:

- `scripts/audit-pools.mjs` — on-chain token decimals + pool token0/token1/fee vs registry.
- `scripts/simulate-routes.mjs` — QuoterV2 quote for every pool, both directions.
- `scripts/verify-bridge-helper.mjs` — helper selectors in bytecode + FeeRouter sanity.
- `scripts/e2e-solana-bridge.mjs` — Push SVM gateway + PDAs initialized on Devnet; Solana tx size vs 1232-byte limit; sample helper calldata.

## License

Private — MoleSwap
