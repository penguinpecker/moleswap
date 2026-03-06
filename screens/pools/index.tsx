"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { NavBar, BackgroundImage } from "../shared";
import { Droplets, RefreshCw, Plus, Minus, ArrowUpRight, ChevronDown } from "lucide-react";
import { usePushWalletContext, usePushChainClient, PushUI } from "@pushchain/ui-kit";
import {
  CONTRACTS, TOKENS, POOLS as AMM_POOLS,
  getTokenByAddress, findPool,
  getSwapQuote, getProvider,
  AMM_ROUTER, AMM_FACTORY, PUSHCHAIN_CHAIN_ID,
  type TokenInfo, type PoolInfo,
} from "@/lib/pushchain/amm";
import { ethers } from "ethers";

// ═══ HELPERS ═══
const fmt = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(2);
};

const chainColors: Record<string, string> = {
  "Ethereum": "#627EEA",
  "Solana": "#9945FF",
  "Base": "#0052FF",
  "Arbitrum": "#28A0F0",
  "BNB Chain": "#F0B90B",
  "Push Chain": "#D548EC",
};

// ═══ POOL DATA (derived from on-chain contracts) ═══
interface PoolDisplay {
  name: string;
  token0: TokenInfo;
  token1: TokenInfo;
  pool: PoolInfo;
  fee: number;
  tvl: number;
  apy: number;
  apr: number;
  util: number;
  vol24h: number;
  active: boolean;
}

function buildPoolDisplays(): PoolDisplay[] {
  return AMM_POOLS.map((pool, i) => {
    const t0 = TOKENS.find(t => t.address.toLowerCase() === pool.token0.toLowerCase());
    const t1 = TOKENS.find(t => t.address.toLowerCase() === pool.token1.toLowerCase());
    if (!t0 || !t1) return null;

    // Simulated metrics (replace with on-chain reads when available)
    const seed = i * 7 + 13;
    const base = 50000 + (seed * 1337) % 500000;
    return {
      name: pool.name,
      token0: t0,
      token1: t1,
      pool,
      fee: pool.fee,
      tvl: base,
      apy: +(2 + (seed % 12) + Math.random() * 3).toFixed(1),
      apr: +(3 + (seed % 10) + Math.random() * 4).toFixed(1),
      util: +(20 + (seed % 55) + Math.random() * 10).toFixed(1),
      vol24h: base * 0.3 + Math.random() * base * 0.2,
      active: true,
    };
  }).filter(Boolean) as PoolDisplay[];
}

// ═══ SMALL COMPONENTS ═══
const Badge = ({ chain }: { chain: string }) => {
  const c = chainColors[chain] || "#D548EC";
  return (
    <span
      className="font-family-ThaleahFat rounded-sm px-1.5 py-px text-[9px] tracking-wider"
      style={{ color: c, background: c + "22", border: `1px solid ${c}33` }}
    >
      {chain.toUpperCase()}
    </span>
  );
};

const TokenIcon = ({ token, size = 28 }: { token: TokenInfo; size?: number }) => {
  const [err, setErr] = useState(false);
  if (err || !token.logoURI) {
    return (
      <div
        className="bg-ground-button border-ground-button-border flex items-center justify-center rounded border-2"
        style={{ width: size, height: size }}
      >
        <span className="font-family-ThaleahFat text-peach-300" style={{ fontSize: size * 0.35 }}>
          {token.symbol.slice(0, 2)}
        </span>
      </div>
    );
  }
  return (
    <img
      src={token.logoURI}
      alt={token.symbol}
      width={size}
      height={size}
      className="border-ground-button-border rounded border-2"
      onError={() => setErr(true)}
    />
  );
};

const TokenPair = ({ t0, t1, size = 28 }: { t0: TokenInfo; t1: TokenInfo; size?: number }) => (
  <div className="flex items-center">
    <TokenIcon token={t0} size={size} />
    <div style={{ marginLeft: -size * 0.25, zIndex: 1 }}>
      <TokenIcon token={t1} size={size * 0.7} />
    </div>
  </div>
);

const UtilBar = ({ pct }: { pct: number }) => {
  const c = pct > 80 ? "#ef4444" : pct > 60 ? "#feae34" : "#6DBB3E";
  return (
    <div className="border-ground-button-border h-1.5 w-full overflow-hidden rounded-sm border bg-[#281a12]">
      <div
        className="h-full rounded-sm transition-all duration-500"
        style={{ width: `${pct}%`, background: `linear-gradient(180deg, ${c}, ${c}88)` }}
      />
    </div>
  );
};

// ═══ MAIN PAGE ═══
const PoolsPage = () => (
  <div className="relative flex min-h-screen w-full flex-col items-center gap-4">
    <BackgroundImage />
    <div className="relative z-50 mx-auto mt-4 mb-auto block max-sm:w-full">
      <NavBar />
    </div>
    <div className="relative z-20 flex w-full flex-1 justify-center">
      <PoolsContent />
    </div>
  </div>
);

export default PoolsPage;

// ═══ CONTENT ═══
const PoolsContent = () => {
  const walletCtx = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const isConnected = walletCtx?.connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const address = walletCtx?.universalAccount?.address || pushChainClient?.universal?.account || null;

  const [tab, setTab] = useState<"markets" | "positions">("markets");
  const [selectedPool, setSelectedPool] = useState<PoolDisplay | null>(null);
  const [sort, setSort] = useState<"tvl" | "apy" | "vol">("tvl");
  const [chainFilter, setChainFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const pools = useMemo(() => buildPoolDisplays(), []);
  const chains = useMemo(() => ["all", ...new Set(pools.map(p => p.token0.sourceChain))], [pools]);

  const filtered = pools.filter(p => chainFilter === "all" || p.token0.sourceChain === chainFilter);
  const sorted = [...filtered].sort((a, b) =>
    sort === "tvl" ? b.tvl - a.tvl : sort === "apy" ? b.apy - a.apy : b.vol24h - a.vol24h
  );

  const totalTvl = pools.reduce((s, p) => s + p.tvl, 0);
  const totalVol = pools.reduce((s, p) => s + p.vol24h, 0);
  const avgApy = pools.reduce((s, p) => s + p.apy, 0) / pools.length;

  const tabClass = (t: string) =>
    `font-family-ThaleahFat text-shadow-black px-6 py-1 rounded-full text-xl sm:text-2xl transition-colors duration-150 cursor-pointer ${
      tab === t
        ? "bg-ground-button border-4 border-ground-button-border text-peach-400"
        : "text-gray-400 hover:text-yellow-200 border-4 border-transparent"
    }`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-2 sm:p-6">
      {/* Header */}
      <div className="relative top-[40px] z-10 mx-auto w-[85%] rounded-lg px-6 py-4 text-center">
        <h1 className="text-peach-300 text-shadow-header font-family-ThaleahFat text-3xl font-bold tracking-widest uppercase sm:text-5xl">
          UNIVERSAL POOLS
        </h1>
        <p className="font-family-ThaleahFat mt-1 text-[10px] tracking-wider text-gray-400">
          PUSHCHAIN DONUT TESTNET — ALL ASSETS BRIDGED VIA PRC-20
        </p>
        <Image
          src="/quest/header-quest-bg.png" alt="Header" width={200} height={200}
          className="absolute inset-0 left-0 z-[-1] h-full w-full"
        />
      </div>

      {/* Main Content */}
      <div className="relative mb-6 h-full min-h-[500px]">
        <Image
          src="/quest/Quest-BG.png" alt="BG" width={200} height={200}
          className="absolute inset-0 z-0 h-full w-full object-fill"
        />

        {/* Tabs */}
        <div className="relative z-50 mt-12 flex justify-center gap-4 px-4 pt-3">
          <button className={tabClass("markets")} onClick={() => setTab("markets")}>
            <Droplets className="mr-2 inline h-5 w-5" /> MARKETS
          </button>
          <button className={tabClass("positions")} onClick={() => setTab("positions")}>
            POSITIONS
          </button>
        </div>

        <div className="relative z-10 mx-auto mt-4 mb-8 w-[95%] p-2 sm:p-4">
          {selectedPool ? (
            <PoolDetail pool={selectedPool} onBack={() => setSelectedPool(null)} address={address} isConnected={isConnected} walletCtx={walletCtx} />
          ) : tab === "markets" ? (
            <>
              {/* Stats row */}
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { l: "TOTAL VALUE LOCKED", v: `$${fmt(totalTvl)}`, icon: "🏦" },
                  { l: "24H VOLUME", v: `$${fmt(totalVol)}`, icon: "📊" },
                  { l: "ACTIVE POOLS", v: `${pools.filter(p => p.active).length}/${pools.length}`, icon: "💧" },
                  { l: "AVG SUPPLY APY", v: `${avgApy.toFixed(1)}%`, icon: "📈" },
                ].map((s, i) => (
                  <div key={i} className="relative rounded px-3 py-2 text-center">
                    <Image src="/quest/header-quest-bg.png" alt="" width={200} height={200}
                      className="absolute inset-0 z-[-1] h-full w-full rounded" />
                    <div className="text-sm">{s.icon}</div>
                    <div className="font-family-ThaleahFat text-[8px] tracking-wider text-gray-400">{s.l}</div>
                    <div className="font-family-ThaleahFat text-peach-300 text-lg">{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Chain filter */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {chains.map(ch => (
                  <button
                    key={ch}
                    onClick={() => setChainFilter(ch)}
                    className={`font-family-ThaleahFat cursor-pointer rounded px-2.5 py-1 text-[9px] tracking-wider transition-all ${
                      chainFilter === ch
                        ? "border border-yellow-400 text-yellow-400"
                        : "border border-gray-700 text-gray-500 hover:text-gray-300"
                    }`}
                    style={chainFilter === ch && ch !== "all" ? {
                      borderColor: chainColors[ch] || "#D548EC",
                      color: chainColors[ch] || "#D548EC",
                      background: (chainColors[ch] || "#D548EC") + "18",
                    } : {}}
                  >
                    {ch === "all" ? "ALL CHAINS" : ch.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="mb-2 flex justify-end gap-1">
                {([["tvl", "TVL"], ["apy", "APY"], ["vol", "VOLUME"]] as const).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setSort(k)}
                    className={`font-family-ThaleahFat cursor-pointer rounded px-3 py-1 text-[10px] transition-all ${
                      sort === k
                        ? "bg-ground-button border-ground-button-border text-peach-500 border"
                        : "border border-transparent text-gray-500"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* Column headers (desktop) */}
              <div className="hidden px-3 pb-1.5 sm:grid" style={{ gridTemplateColumns: "2.4fr .6fr .7fr .7fr .5fr .9fr" }}>
                {["POOL", "TVL", "SUPPLY", "BORROW", "UTIL", ""].map((h, i) => (
                  <span key={i} className={`font-family-ThaleahFat text-[9px] tracking-wider text-gray-500 ${i > 0 ? "text-right" : ""}`}>
                    {h}
                  </span>
                ))}
              </div>

              {/* Pool rows */}
              <div className="flex flex-col gap-1.5">
                {sorted.map((p, i) => (
                  <button
                    key={p.pool.address}
                    onClick={() => setSelectedPool(p)}
                    className="relative w-full cursor-pointer rounded text-left transition-all hover:scale-[1.005]"
                  >
                    <Image src="/quest/header-quest-bg.png" alt="" width={200} height={200}
                      className="absolute inset-0 z-[-1] h-full w-full rounded" />

                    {/* Desktop row */}
                    <div className="hidden items-center gap-1 px-3 py-2.5 sm:grid" style={{ gridTemplateColumns: "2.4fr .6fr .7fr .7fr .5fr .9fr" }}>
                      <div className="flex items-center gap-2">
                        <TokenPair t0={p.token0} t1={p.token1} size={28} />
                        <div>
                          <div className="font-family-ThaleahFat text-[15px] tracking-wider text-white">{p.name}</div>
                          <div className="mt-0.5 flex gap-1">
                            <Badge chain={p.token0.sourceChain} />
                            <span className="font-family-ThaleahFat bg-ground-button-border rounded-sm px-1 py-px text-[8px] text-gray-400">
                              {(p.fee / 10000).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="font-family-ThaleahFat text-right text-sm text-white">${fmt(p.tvl)}</div>
                      <div className="font-family-ThaleahFat text-right text-sm text-[#6DBB3E]">{p.apy}%</div>
                      <div className="font-family-ThaleahFat text-peach-500 text-right text-sm">{p.apr}%</div>
                      <div><UtilBar pct={p.util} /></div>
                      <div className="flex justify-end gap-1">
                        <span className="font-family-ThaleahFat rounded bg-[#6DBB3E] px-2 py-1 text-[10px] text-white shadow-[0_-2px_0_#4A8B29_inset]">
                          SUPPLY
                        </span>
                        <span className="font-family-ThaleahFat bg-ground-button border-ground-button-border rounded border px-2 py-1 text-[10px] text-white">
                          BORROW
                        </span>
                      </div>
                    </div>

                    {/* Mobile row */}
                    <div className="flex items-center justify-between px-3 py-3 sm:hidden">
                      <div className="flex items-center gap-2">
                        <TokenPair t0={p.token0} t1={p.token1} size={24} />
                        <div>
                          <div className="font-family-ThaleahFat text-sm text-white">{p.name}</div>
                          <Badge chain={p.token0.sourceChain} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-family-ThaleahFat text-sm text-[#6DBB3E]">{p.apy}% APY</div>
                        <div className="font-family-ThaleahFat text-[10px] text-gray-400">${fmt(p.tvl)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* ═══ MY POSITIONS — empty state with mole wave ═══ */
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="animate-[float_2s_ease-in-out_infinite]">
                <Image
                  src="/profile/c2.png"
                  alt="Mole waving"
                  width={80}
                  height={80}
                  className="object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <p className="font-family-ThaleahFat text-shadow-black text-2xl tracking-wider text-white">
                NO ACTIVE POSITIONS
              </p>
              <p className="font-family-ThaleahFat max-w-xs text-center text-sm text-gray-400">
                SUPPLY OR BORROW PRC-20 ASSETS ON PUSHCHAIN TO START EARNING
              </p>
              {!isConnected ? (
                <button
                  onClick={() => walletCtx?.handleConnectToPushWallet?.()}
                  className="font-family-ThaleahFat bg-peach-500 border-3 mt-2 cursor-pointer rounded-lg border-[#523525] px-8 py-3 text-xl tracking-wider text-black shadow-[0px_-6px_0px_0px_#C97E00_inset,0px_7.5px_0px_0px_rgba(255,212,122,0.6)_inset] transition-all hover:scale-[1.02]"
                >
                  CONNECT WALLET
                </button>
              ) : (
                <button
                  onClick={() => setTab("markets")}
                  className="font-family-ThaleahFat mt-2 cursor-pointer rounded-lg bg-[#6DBB3E] px-8 py-3 text-xl tracking-wider text-white shadow-[0px_-4px_0px_0px_#4A8B29_inset,0px_4px_0px_0px_rgba(255,255,255,0.3)_inset] transition-all hover:scale-[1.02]"
                >
                  EXPLORE MARKETS
                </button>
              )}
            </div>
          )}

          {/* Footer tag */}
          <p className="font-family-ThaleahFat mt-6 text-center text-[8px] tracking-widest text-gray-600">
            PUSHCHAIN V3 CONCENTRATED LIQUIDITY — DONUT TESTNET — ALL POOLS PAIRED VS WPC
          </p>
        </div>
      </div>
    </div>
  );
};

// ═══ POOL DETAIL ═══
const PoolDetail = ({ pool, onBack, address, isConnected, walletCtx }: {
  pool: PoolDisplay; onBack: () => void; address: string | null; isConnected: boolean; walletCtx: any;
}) => {
  const [actionTab, setActionTab] = useState<"supply" | "borrow" | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txDone, setTxDone] = useState(false);

  const handleAction = async () => {
    if (!amount || !address) return;
    setLoading(true);
    try {
      // TODO: Wire up actual supply/borrow when contracts support lending
      // For now, simulate tx
      await new Promise(r => setTimeout(r, 2000));
      setTxDone(true);
      setAmount("");
      setTimeout(() => setTxDone(false), 3000);
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="font-family-ThaleahFat text-peach-300 cursor-pointer bg-transparent text-sm">
          ← BACK
        </button>
        <TokenPair t0={pool.token0} t1={pool.token1} size={32} />
        <div>
          <h2 className="font-family-ThaleahFat text-2xl tracking-wider text-white">{pool.name}</h2>
          <div className="mt-0.5 flex gap-1.5">
            <Badge chain={pool.token0.sourceChain} />
            <Badge chain="Push Chain" />
            <span className="font-family-ThaleahFat bg-ground-button-border rounded-sm px-1.5 py-px text-[9px] text-gray-400">
              FEE {(pool.fee / 10000).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {[
          { l: "TVL", v: `$${fmt(pool.tvl)}`, c: "text-peach-500" },
          { l: "24H VOL", v: `$${fmt(pool.vol24h)}`, c: "text-[#6DBB3E]" },
          { l: "SUPPLY APY", v: `${pool.apy}%`, c: "text-[#6DBB3E]" },
          { l: "BORROW APR", v: `${pool.apr}%`, c: "text-peach-500" },
          { l: "UTILIZATION", v: `${pool.util}%`, c: pool.util > 80 ? "text-red-400" : pool.util > 60 ? "text-peach-500" : "text-[#6DBB3E]" },
        ].map((s, i) => (
          <div key={i} className="relative rounded px-2 py-2 text-center">
            <Image src="/quest/header-quest-bg.png" alt="" width={200} height={200}
              className="absolute inset-0 z-[-1] h-full w-full rounded" />
            <div className="font-family-ThaleahFat text-[8px] tracking-wider text-gray-500">{s.l}</div>
            <div className={`font-family-ThaleahFat text-base ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Token composition */}
      <div className="grid grid-cols-2 gap-2">
        {[pool.token0, pool.token1].map((tok, i) => (
          <div key={i} className="relative rounded px-3 py-2.5">
            <Image src="/quest/header-quest-bg.png" alt="" width={200} height={200}
              className="absolute inset-0 z-[-1] h-full w-full rounded" />
            <div className="flex items-center gap-2">
              <TokenIcon token={tok} size={20} />
              <span className="font-family-ThaleahFat text-sm text-white">{tok.symbol}</span>
              <Badge chain={tok.sourceChain} />
            </div>
            <div className="font-family-ThaleahFat mt-1 text-[9px] text-gray-500">LOCKED IN POOL</div>
            <div className="font-family-ThaleahFat text-peach-300 text-lg">
              {fmt(pool.tvl * 0.5 / (i === 0 ? 1 : 0.08))}
            </div>
          </div>
        ))}
      </div>

      {/* Utilization bar */}
      <div className="relative rounded px-3 py-2.5">
        <Image src="/quest/header-quest-bg.png" alt="" width={200} height={200}
          className="absolute inset-0 z-[-1] h-full w-full rounded" />
        <div className="mb-1.5 flex justify-between">
          <span className="font-family-ThaleahFat text-[10px] tracking-wider text-gray-500">POOL UTILIZATION</span>
          <span className={`font-family-ThaleahFat text-[10px] ${pool.util > 80 ? "text-red-400" : pool.util > 60 ? "text-peach-500" : "text-[#6DBB3E]"}`}>
            {pool.util}%
          </span>
        </div>
        <div className="border-ground-button-border h-2.5 overflow-hidden rounded border bg-[#281a12]">
          <div
            className="h-full rounded"
            style={{
              width: `${pool.util}%`,
              background: `linear-gradient(90deg, #6DBB3E, ${pool.util > 60 ? "#feae34" : "#6DBB3E"}, ${pool.util > 80 ? "#ef4444" : "#feae34"})`,
            }}
          />
        </div>
        <div className="font-family-ThaleahFat mt-1 flex justify-between text-[8px]">
          <span className="text-[#6DBB3E]">0% SAFE</span>
          <span className="text-peach-500">OPTIMAL</span>
          <span className="text-red-400">100% MAX</span>
        </div>
      </div>

      {/* Action buttons / form */}
      {!isConnected ? (
        <button
          onClick={() => walletCtx?.handleConnectToPushWallet?.()}
          className="font-family-ThaleahFat bg-peach-500 border-3 w-full cursor-pointer rounded-lg border-[#523525] px-8 py-3 text-xl tracking-wider text-black shadow-[0px_-6px_0px_0px_#C97E00_inset,0px_7.5px_0px_0px_rgba(255,212,122,0.6)_inset] transition-all hover:scale-[1.02]"
        >
          CONNECT WALLET
        </button>
      ) : txDone ? (
        <div className="py-4 text-center">
          <p className="font-family-ThaleahFat text-xl text-[#6DBB3E]">TRANSACTION CONFIRMED ✓</p>
          <p className="font-family-ThaleahFat mt-1 text-sm text-gray-400">+25 XP EARNED</p>
        </div>
      ) : actionTab === null ? (
        <div className="flex gap-2">
          <button
            onClick={() => setActionTab("supply")}
            className="font-family-ThaleahFat flex-1 cursor-pointer rounded-lg bg-[#6DBB3E] px-6 py-3 text-xl tracking-wider text-white shadow-[0px_-4px_0px_0px_#4A8B29_inset,0px_4px_0px_0px_rgba(255,255,255,0.3)_inset] transition-all hover:scale-[1.01]"
          >
            SUPPLY {pool.token0.symbol}
          </button>
          <button
            onClick={() => setActionTab("borrow")}
            className="font-family-ThaleahFat bg-peach-500 flex-1 cursor-pointer rounded-lg px-6 py-3 text-xl tracking-wider text-black shadow-[0px_-4px_0px_0px_#C97E00_inset,0px_4px_0px_0px_rgba(255,212,122,0.6)_inset] transition-all hover:scale-[1.01]"
          >
            BORROW {pool.token0.symbol}
          </button>
        </div>
      ) : (
        <div className="relative rounded-lg px-4 py-4">
          <Image src="/quest/header-quest-bg.png" alt="" width={200} height={200}
            className="absolute inset-0 z-[-1] h-full w-full rounded-lg" />
          <div className="mb-3 flex items-center justify-between">
            <span className="font-family-ThaleahFat text-xl tracking-wider text-white">
              {actionTab === "supply" ? "SUPPLY" : "BORROW"} {pool.token0.symbol}
            </span>
            <button onClick={() => setActionTab(null)} className="font-family-ThaleahFat text-peach-300 cursor-pointer text-sm">✕</button>
          </div>

          {/* Amount input */}
          <div className="relative mb-3 rounded px-3 py-2.5">
            <Image src="/quest/header-quest-bg.png" alt="" width={200} height={200}
              className="absolute inset-0 z-[-1] h-full w-full rounded" />
            <div className="mb-1 flex justify-between">
              <span className="font-family-ThaleahFat text-[10px] text-gray-500">AMOUNT</span>
              <span className="font-family-ThaleahFat text-[10px] text-gray-500">BAL: 0.00 {pool.token0.symbol}</span>
            </div>
            <div className="flex items-center gap-2">
              <TokenIcon token={pool.token0} size={24} />
              <input
                type="text"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.0"
                className="font-family-ThaleahFat w-full flex-1 bg-transparent text-2xl tracking-wider text-white placeholder:text-gray-600 focus:outline-none"
              />
              {["25%", "50%", "MAX"].map(p => (
                <button key={p} className="font-family-ThaleahFat text-peach-500 border-ground-button-border bg-ground-button-border cursor-pointer rounded-sm border px-1.5 py-px text-[9px]">
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Info rows */}
          <div className="relative mb-3 rounded px-3 py-2">
            <Image src="/quest/header-quest-bg.png" alt="" width={200} height={200}
              className="absolute inset-0 z-[-1] h-full w-full rounded" />
            {[
              [actionTab === "supply" ? "SUPPLY APY" : "BORROW APR", `${actionTab === "supply" ? pool.apy : pool.apr}%`, actionTab === "supply" ? "text-[#6DBB3E]" : "text-peach-500"],
              ["UTILIZATION", `${pool.util}%`, "text-peach-300"],
              ["POOL TVL", `$${fmt(pool.tvl)}`, "text-peach-300"],
              ["SOURCE CHAIN", pool.token0.sourceChain, ""],
            ].map(([k, v, c]) => (
              <div key={k} className="flex justify-between py-0.5">
                <span className="font-family-ThaleahFat text-xs text-gray-500">{k}</span>
                <span className={`font-family-ThaleahFat text-xs ${c || "text-peach-300"}`}>{v}</span>
              </div>
            ))}
          </div>

          {/* Health factor (borrow only) */}
          {actionTab === "borrow" && (
            <div className="relative mb-3 rounded px-3 py-2">
              <Image src="/quest/header-quest-bg.png" alt="" width={200} height={200}
                className="absolute inset-0 z-[-1] h-full w-full rounded" />
              <div className="mb-1 flex justify-between">
                <span className="font-family-ThaleahFat text-[10px] text-gray-500">HEALTH FACTOR</span>
                <span className="font-family-ThaleahFat text-xs text-[#6DBB3E]">∞ → 2.45</span>
              </div>
              <div className="border-ground-button-border h-2 overflow-hidden rounded border bg-[#281a12]">
                <div className="h-full w-[82%] rounded" style={{ background: "linear-gradient(90deg, #ef4444, #feae34, #6DBB3E)" }} />
              </div>
              <p className="font-family-ThaleahFat mt-1 text-[8px] text-gray-500">LIQUIDATION IF HEALTH FACTOR &lt; 1.0</p>
            </div>
          )}

          <button
            onClick={handleAction}
            disabled={loading || !amount}
            className={`font-family-ThaleahFat w-full cursor-pointer rounded-lg px-6 py-3 text-xl tracking-wider transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 ${
              actionTab === "supply"
                ? "bg-[#6DBB3E] text-white shadow-[0px_-4px_0px_0px_#4A8B29_inset,0px_4px_0px_0px_rgba(255,255,255,0.3)_inset]"
                : "bg-peach-500 text-black shadow-[0px_-4px_0px_0px_#C97E00_inset,0px_4px_0px_0px_rgba(255,212,122,0.6)_inset]"
            }`}
          >
            {loading ? "MINING..." : `${actionTab === "supply" ? "SUPPLY" : "BORROW"} ${pool.token0.symbol}`}
          </button>
        </div>
      )}
    </div>
  );
};
