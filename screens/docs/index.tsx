"use client";

import React, { useState, useEffect } from "react";

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://moleswap-eight.vercel.app";

interface EndpointDef {
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
  params?: { name: string; type: string; required: boolean; desc: string }[];
  body?: { name: string; type: string; required: boolean; desc: string }[];
  example: string;
  tryIt?: { url?: string; body?: any };
}

const ENDPOINTS: EndpointDef[] = [
  {
    method: "GET",
    path: "/api/v1/tokens",
    title: "List Tokens",
    description: "Get all supported PRC-20 tokens on PushChain, including contract addresses for the core AMM.",
    params: [
      { name: "chain", type: "string", required: false, desc: "Filter by source chain (Ethereum, Solana, Base, Arbitrum, BNB Chain)" },
      { name: "search", type: "string", required: false, desc: "Search by symbol, name, or address" },
    ],
    example: `curl "${BASE_URL}/api/v1/tokens"

// Filter by chain
curl "${BASE_URL}/api/v1/tokens?chain=Ethereum"

// Search
curl "${BASE_URL}/api/v1/tokens?search=USDC"`,
    tryIt: { url: "/api/v1/tokens?chain=Ethereum" },
  },
  {
    method: "GET",
    path: "/api/v1/pools",
    title: "List Pools",
    description: "Get all live AMM pools with real-time on-chain data: price, liquidity, tick, and fee tier.",
    params: [
      { name: "includeEmpty", type: "boolean", required: false, desc: "Include pools with zero liquidity (default: false)" },
    ],
    example: `curl "${BASE_URL}/api/v1/pools"

// Include empty pools
curl "${BASE_URL}/api/v1/pools?includeEmpty=true"`,
    tryIt: { url: "/api/v1/pools" },
  },
  {
    method: "GET",
    path: "/api/v1/pool/:address",
    title: "Pool Detail",
    description: "Get detailed info for a single pool including token balances held by the pool contract.",
    params: [
      { name: "address", type: "string", required: true, desc: "Pool contract address" },
    ],
    example: `// pETH/WPC pool
curl "${BASE_URL}/api/v1/pool/0x012d5C099f8AE00009f40824317a18c3A342f622"`,
    tryIt: { url: "/api/v1/pool/0x012d5C099f8AE00009f40824317a18c3A342f622" },
  },
  {
    method: "GET",
    path: "/api/v1/quote",
    title: "Swap Quote",
    description: "Get a real-time swap quote from the on-chain QuoterV2. Supports direct swaps and multi-hop routing through WPC.",
    params: [
      { name: "tokenIn", type: "address", required: true, desc: "Input token address (use 0x0...0 for native PC)" },
      { name: "tokenOut", type: "address", required: true, desc: "Output token address" },
      { name: "amountIn", type: "string", required: true, desc: "Input amount in WEI (raw BigInt string)" },
      { name: "fee", type: "number", required: false, desc: "Fee tier override (100, 500, 3000, 10000)" },
    ],
    example: `// Quote 1 PC → pETH (1e18 wei)
curl "${BASE_URL}/api/v1/quote?tokenIn=0x0000000000000000000000000000000000000000&tokenOut=0x2971824Db68229D087931155C2b8bB820B275809&amountIn=1000000000000000000"`,
    tryIt: {
      url: "/api/v1/quote?tokenIn=0x0000000000000000000000000000000000000000&tokenOut=0x2971824Db68229D087931155C2b8bB820B275809&amountIn=1000000000000000000",
    },
  },
  {
    method: "POST",
    path: "/api/v1/tx/swap",
    title: "Build Swap TX",
    description: "Returns unsigned transaction calldata for a swap. Your backend signs and submits — we never touch private keys. Includes wrap, approve, and swap steps.",
    body: [
      { name: "tokenIn", type: "address", required: true, desc: "Input token address" },
      { name: "tokenOut", type: "address", required: true, desc: "Output token address" },
      { name: "amountIn", type: "string", required: true, desc: "Amount in WEI" },
      { name: "recipient", type: "address", required: true, desc: "Address to receive output tokens" },
      { name: "amountOutMin", type: "string", required: false, desc: "Minimum output (auto-calculated from slippageBps if omitted)" },
      { name: "slippageBps", type: "number", required: false, desc: "Slippage in basis points (default: 50 = 0.5%)" },
      { name: "fee", type: "number", required: false, desc: "Fee tier override" },
      { name: "deadline", type: "number", required: false, desc: "Unix timestamp deadline (default: +30 min)" },
    ],
    example: `curl -X POST "${BASE_URL}/api/v1/tx/swap" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tokenIn": "0x0000000000000000000000000000000000000000",
    "tokenOut": "0x2971824Db68229D087931155C2b8bB820B275809",
    "amountIn": "1000000000000000000",
    "recipient": "0xYOUR_WALLET_ADDRESS",
    "slippageBps": 50
  }'`,
    tryIt: {
      body: {
        tokenIn: "0x0000000000000000000000000000000000000000",
        tokenOut: "0x2971824Db68229D087931155C2b8bB820B275809",
        amountIn: "1000000000000000000",
        recipient: "0x0000000000000000000000000000000000000001",
        slippageBps: 50,
      },
    },
  },
  {
    method: "POST",
    path: "/api/v1/tx/create-pool",
    title: "Create Pool",
    description: "Build calldata to create a new pool on the Factory, initialize it with a price, and optionally seed initial liquidity — all in one call.",
    body: [
      { name: "tokenA", type: "address", required: true, desc: "First token address" },
      { name: "tokenB", type: "address", required: true, desc: "Second token address" },
      { name: "recipient", type: "address", required: true, desc: "Address to receive LP NFT" },
      { name: "fee", type: "number", required: false, desc: "Fee tier (100, 500, 3000, 10000). Default: 500" },
      { name: "initialPrice", type: "number", required: false, desc: "Initial price of token0 in terms of token1" },
      { name: "amount0Desired", type: "string", required: false, desc: "Initial liquidity for token0 (wei)" },
      { name: "amount1Desired", type: "string", required: false, desc: "Initial liquidity for token1 (wei)" },
      { name: "tickLower", type: "number", required: false, desc: "Lower tick bound (default: full range)" },
      { name: "tickUpper", type: "number", required: false, desc: "Upper tick bound (default: full range)" },
      { name: "slippageBps", type: "number", required: false, desc: "Slippage tolerance (default: 100 = 1%)" },
    ],
    example: `curl -X POST "${BASE_URL}/api/v1/tx/create-pool" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tokenA": "0xYOUR_NEW_TOKEN",
    "tokenB": "0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9",
    "fee": 500,
    "initialPrice": 0.001,
    "amount0Desired": "1000000000000000000000",
    "amount1Desired": "1000000000000000000",
    "recipient": "0xYOUR_WALLET"
  }'`,
  },
  {
    method: "POST",
    path: "/api/v1/tx/add-liquidity",
    title: "Add Liquidity",
    description: "Build calldata to add liquidity to an existing pool via the NonfungiblePositionManager. Returns wrap + approve + mint steps.",
    body: [
      { name: "token0", type: "address", required: true, desc: "First token address" },
      { name: "token1", type: "address", required: true, desc: "Second token address" },
      { name: "amount0Desired", type: "string", required: true, desc: "Amount of token0 (wei)" },
      { name: "amount1Desired", type: "string", required: true, desc: "Amount of token1 (wei)" },
      { name: "recipient", type: "address", required: true, desc: "Address to receive LP NFT" },
      { name: "fee", type: "number", required: false, desc: "Fee tier (default: 500)" },
      { name: "tickLower", type: "number", required: false, desc: "Lower tick (default: full range)" },
      { name: "tickUpper", type: "number", required: false, desc: "Upper tick (default: full range)" },
      { name: "slippageBps", type: "number", required: false, desc: "Slippage (default: 50 = 0.5%)" },
    ],
    example: `curl -X POST "${BASE_URL}/api/v1/tx/add-liquidity" \\
  -H "Content-Type: application/json" \\
  -d '{
    "token0": "0x2971824Db68229D087931155C2b8bB820B275809",
    "token1": "0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9",
    "amount0Desired": "500000000000000000",
    "amount1Desired": "1000000000000000000",
    "recipient": "0xYOUR_WALLET",
    "fee": 500
  }'`,
  },
];

function MethodBadge({ method }: { method: string }) {
  const bg = method === "GET" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30";
  return (
    <span className={`px-2 py-0.5 text-xs font-bold border rounded ${bg}`} style={{ fontFamily: "monospace" }}>
      {method}
    </span>
  );
}

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="bg-black/60 border border-white/10 rounded-lg p-4 overflow-x-auto text-sm text-green-300/90" style={{ fontFamily: "'Courier New', monospace" }}>
        <code>{code}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 text-white/60 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? "COPIED!" : "COPY"}
      </button>
    </div>
  );
}

function TryItButton({ endpoint }: { endpoint: EndpointDef }) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const isPost = endpoint.method === "POST";
      const url = isPost
        ? `${BASE_URL}${endpoint.path}`
        : `${BASE_URL}${endpoint.tryIt?.url || endpoint.path}`;

      const res = await fetch(url, {
        method: endpoint.method,
        headers: isPost ? { "Content-Type": "application/json" } : undefined,
        body: isPost && endpoint.tryIt?.body ? JSON.stringify(endpoint.tryIt.body) : undefined,
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (!endpoint.tryIt) return null;

  return (
    <div className="mt-3">
      <button
        onClick={run}
        disabled={loading}
        className="px-4 py-2 bg-[#7C5CFC] hover:bg-[#6B4DE0] disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors"
        style={{ fontFamily: "'ThaleahFat', sans-serif" }}
      >
        {loading ? "⏳ LOADING..." : "▶ TRY IT LIVE"}
      </button>
      {result && (
        <div className="mt-2">
          <pre className="bg-black/80 border border-[#7C5CFC]/30 rounded-lg p-4 overflow-x-auto text-xs text-white/80 max-h-80 overflow-y-auto" style={{ fontFamily: "'Courier New', monospace" }}>
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}

function EndpointCard({ ep }: { ep: EndpointDef }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center gap-3 text-left"
      >
        <MethodBadge method={ep.method} />
        <span className="text-white/90 font-mono text-sm flex-1">{ep.path}</span>
        <span className="text-white/40 text-sm hidden sm:block" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>{ep.title}</span>
        <span className={`text-white/30 transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-white/5 space-y-4">
          <p className="text-white/60 text-sm pt-3">{ep.description}</p>

          {ep.params && ep.params.length > 0 && (
            <div>
              <h4 className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
                Parameters
              </h4>
              <div className="space-y-1">
                {ep.params.map((p) => (
                  <div key={p.name} className="flex items-start gap-2 text-sm">
                    <code className="text-[#7C5CFC] font-mono shrink-0">{p.name}</code>
                    <span className="text-white/30 font-mono text-xs mt-0.5">{p.type}</span>
                    {p.required && <span className="text-red-400 text-xs mt-0.5">required</span>}
                    <span className="text-white/50">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ep.body && ep.body.length > 0 && (
            <div>
              <h4 className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
                Request Body (JSON)
              </h4>
              <div className="space-y-1">
                {ep.body.map((p) => (
                  <div key={p.name} className="flex items-start gap-2 text-sm">
                    <code className="text-[#7C5CFC] font-mono shrink-0">{p.name}</code>
                    <span className="text-white/30 font-mono text-xs mt-0.5">{p.type}</span>
                    {p.required && <span className="text-red-400 text-xs mt-0.5">required</span>}
                    <span className="text-white/50">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
              Example
            </h4>
            <CodeBlock code={ep.example} />
          </div>

          <TryItButton endpoint={ep} />
        </div>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-b from-[#7C5CFC]/10 to-transparent">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#7C5CFC] rounded-lg flex items-center justify-center text-xl">
              🔧
            </div>
            <h1 className="text-3xl sm:text-4xl" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
              MOLESWAP API
            </h1>
          </div>
          <p className="text-white/50 text-lg max-w-2xl">
            Public REST API for integrating with MoleSwap DEX on PushChain.
            Get quotes, build swap transactions, create pools, and add liquidity — all without touching private keys.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/60">
              Base URL: <code className="text-[#7C5CFC]">{BASE_URL}/api/v1</code>
            </div>
            <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/60">
              Chain ID: <code className="text-[#7C5CFC]">2442</code>
            </div>
            <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/60">
              Rate Limit: <code className="text-[#7C5CFC]">60 req/min</code> (reads) · <code className="text-[#7C5CFC]">20 req/min</code> (writes)
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">
        {/* Quick Start */}
        <section>
          <h2 className="text-xl mb-4" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
            QUICK START
          </h2>
          <div className="space-y-4">
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
              <h3 className="text-white/80 font-bold mb-3" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
                1. GET A QUOTE
              </h3>
              <CodeBlock code={`// Get a quote for 1 PC → pETH
const res = await fetch(
  "${BASE_URL}/api/v1/quote?tokenIn=0x0000000000000000000000000000000000000000&tokenOut=0x2971824Db68229D087931155C2b8bB820B275809&amountIn=1000000000000000000"
);
const { data } = await res.json();
console.log(data.amountOut, data.route);`} lang="javascript" />
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
              <h3 className="text-white/80 font-bold mb-3" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
                2. BUILD A SWAP TX
              </h3>
              <CodeBlock code={`// Build unsigned swap calldata
const res = await fetch("${BASE_URL}/api/v1/tx/swap", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tokenIn: "0x0000000000000000000000000000000000000000",
    tokenOut: "0x2971824Db68229D087931155C2b8bB820B275809",
    amountIn: "1000000000000000000",
    recipient: "0xYOUR_WALLET",
    slippageBps: 50
  })
});
const { data } = await res.json();
// data.transactions = [{ to, value, data, description }, ...]
// Sign & send each transaction sequentially with your wallet`} lang="javascript" />
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
              <h3 className="text-white/80 font-bold mb-3" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
                3. CREATE A NEW POOL (TOKEN LAUNCHERS)
              </h3>
              <CodeBlock code={`// Create a pool for your new token paired with WPC
const res = await fetch("${BASE_URL}/api/v1/tx/create-pool", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tokenA: "0xYOUR_NEW_TOKEN",
    tokenB: "0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9", // WPC
    fee: 500,
    initialPrice: 0.001,
    amount0Desired: "1000000000000000000000", // 1000 tokens
    amount1Desired: "1000000000000000000",    // 1 WPC
    recipient: "0xYOUR_WALLET"
  })
});
const { data } = await res.json();
// data.transactions = sequential steps to create, initialize, and fund the pool`} lang="javascript" />
            </div>
          </div>
        </section>

        {/* SDK */}
        <section>
          <h2 className="text-xl mb-4" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
            TYPESCRIPT SDK
          </h2>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-4">
            <p className="text-white/60 text-sm">
              Install the SDK for a cleaner integration — it wraps all API calls with TypeScript types.
            </p>
            <CodeBlock code={`npm install @moleswap/sdk`} />
            <CodeBlock code={`import { MoleSwap } from "@moleswap/sdk";

const mole = new MoleSwap();

// Get all tokens
const { tokens } = await mole.getTokens();

// Get all pools with live data
const { pools } = await mole.getPools();

// Get a swap quote
const quote = await mole.getQuote({
  tokenIn: "0x0000000000000000000000000000000000000000",
  tokenOut: "0x2971824Db68229D087931155C2b8bB820B275809",
  amountIn: "1000000000000000000",
});

// Build swap calldata (you sign & send)
const { transactions } = await mole.buildSwapTx({
  tokenIn: "0x0000000000000000000000000000000000000000",
  tokenOut: "0x2971824Db68229D087931155C2b8bB820B275809",
  amountIn: "1000000000000000000",
  recipient: "0xYOUR_WALLET",
});

// Create a new pool for your token
const { transactions: poolTxs } = await mole.buildCreatePoolTx({
  tokenA: "0xYOUR_TOKEN",
  tokenB: "0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9",
  fee: 500,
  initialPrice: 0.001,
  amount0Desired: "1000000000000000000000",
  amount1Desired: "1000000000000000000",
  recipient: "0xYOUR_WALLET",
});`} lang="typescript" />
          </div>
        </section>

        {/* Contracts Reference */}
        <section>
          <h2 className="text-xl mb-4" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
            CONTRACT ADDRESSES
          </h2>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-white/50 font-normal">Contract</th>
                  <th className="text-left px-4 py-3 text-white/50 font-normal">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["Factory", "0x81b8Bca02580C7d6b636051FDb7baAC436bFb454"],
                  ["SwapRouter", "0x5D548bB9E305AAe0d6dc6e6fdc3ab419f6aC0037"],
                  ["QuoterV2", "0x83316275f7C2F79BC4E26f089333e88E89093037"],
                  ["PositionManager", "0xf9b3ac66aed14A2C7D9AA7696841aB6B27a6231e"],
                  ["WPC (WETH9)", "0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9"],
                  ["TickLens", "0xb64113Fc16055AfE606f25658812EE245Aa41dDC"],
                  ["Multicall", "0xa8c00017955c8654bfFbb6d5179c99f5aB8B7849"],
                ].map(([name, addr]) => (
                  <tr key={name}>
                    <td className="px-4 py-2.5 text-white/80" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>{name}</td>
                    <td className="px-4 py-2.5">
                      <a
                        href={`https://donut.push.network/address/${addr}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#7C5CFC] hover:underline font-mono text-xs"
                      >
                        {addr}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Token Launcher Flow */}
        <section>
          <h2 className="text-xl mb-4" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
            TOKEN LAUNCHER INTEGRATION FLOW
          </h2>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="space-y-3">
              {[
                { step: "1", title: "Deploy your PRC-20 token", desc: "Deploy your token contract on PushChain Donut Testnet" },
                { step: "2", title: "Call POST /api/v1/tx/create-pool", desc: "Pair your token with WPC. Set initialPrice and seed amounts. API returns all calldata." },
                { step: "3", title: "Sign & send the transactions", desc: "Sequentially sign: createPool → initialize → wrap (if needed) → approve × 2 → mint. Wait for each to confirm." },
                { step: "4", title: "Your token is now swappable!", desc: "Users can swap via MoleSwap UI or via the API. Use GET /api/v1/quote for price feeds." },
                { step: "5", title: "Integrate swaps in your app", desc: "Use POST /api/v1/tx/swap to build swap calldata. Your frontend signs it — we just provide the data." },
              ].map((s) => (
                <div key={s.step} className="flex gap-4">
                  <div className="shrink-0 w-8 h-8 bg-[#7C5CFC]/20 border border-[#7C5CFC]/30 rounded-lg flex items-center justify-center text-[#7C5CFC] font-bold text-sm">
                    {s.step}
                  </div>
                  <div>
                    <div className="text-white/90 font-bold text-sm" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>{s.title}</div>
                    <div className="text-white/50 text-sm">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Endpoints */}
        <section>
          <h2 className="text-xl mb-4" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
            API REFERENCE
          </h2>
          <div className="space-y-3">
            {ENDPOINTS.map((ep) => (
              <EndpointCard key={ep.path + ep.method} ep={ep} />
            ))}
          </div>
        </section>

        {/* Response Format */}
        <section>
          <h2 className="text-xl mb-4" style={{ fontFamily: "'ThaleahFat', sans-serif" }}>
            RESPONSE FORMAT
          </h2>
          <div className="space-y-4">
            <CodeBlock code={`// Success
{
  "success": true,
  "data": { ... },
  "timestamp": 1711234567890
}

// Error
{
  "success": false,
  "error": "Rate limit exceeded. Try again in 60 seconds.",
  "timestamp": 1711234567890
}

// Rate limit headers included on every response:
// X-RateLimit-Remaining: 57
// X-RateLimit-Reset: 1711234627`} lang="json" />
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-white/10 pt-8 pb-12 text-center text-white/30 text-sm space-y-2">
          <p style={{ fontFamily: "'ThaleahFat', sans-serif" }}>MOLESWAP — BUILT ON PUSHCHAIN</p>
          <p>
            <a href="https://github.com/penguinpecker/moleswap" target="_blank" rel="noopener noreferrer" className="text-[#7C5CFC] hover:underline">
              GitHub
            </a>
            {" · "}
            <a href="https://moleswap-eight.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[#7C5CFC] hover:underline">
              Live App
            </a>
            {" · "}
            <a href="https://donut.push.network" target="_blank" rel="noopener noreferrer" className="text-[#7C5CFC] hover:underline">
              Explorer
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
