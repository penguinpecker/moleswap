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

## License

Private — MoleSwap
