"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { NavBar, BackgroundImage } from "../shared";
import { Plus, Minus, Droplets, RefreshCw, ArrowDown, ExternalLink } from "lucide-react";
import { usePushWallet, PushUniversalAccountButton } from "@/lib/pushchain/provider";
import {
  getAllPools, addLiquidity, removeLiquidity, getSwapQuote,
  getPairReserves, approveToken, AMM_ROUTER, AMM_FACTORY,
  PUSHCHAIN_CHAIN_ID, type Pool, type PushChainToken,
} from "@/lib/pushchain/amm";

const PoolsPage = () => {
  return (
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
};

export default PoolsPage;

const PoolsContent = () => {
  const { isConnected, address } = usePushWallet();
  const [activeTab, setActiveTab] = useState<"pools" | "add" | "remove">("pools");
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);

  const fetchPools = useCallback(async () => {
    if (!AMM_FACTORY) return;
    setLoading(true);
    try {
      const data = await getAllPools(address || undefined);
      setPools(data);
    } catch (err) {
      console.error("Failed to fetch pools:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected) fetchPools();
  }, [isConnected, fetchPools]);

  const tabClass = (tab: string) =>
    `font-family-ThaleahFat text-shadow-black px-6 py-1 rounded-full text-xl sm:text-2xl transition-colors duration-150 cursor-pointer ${
      activeTab === tab
        ? "bg-ground-button border-4 border-ground-button-border text-peach-400"
        : "text-gray-400 hover:text-yellow-200 border-4 border-transparent"
    }`;

  const contractsDeployed = !!AMM_FACTORY && !!AMM_ROUTER;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-2 sm:p-6">
      {/* Header */}
      <div className="relative top-[40px] z-10 mx-auto w-[85%] rounded-lg px-6 py-4 text-center">
        <h1 className="text-peach-300 text-shadow-header font-family-ThaleahFat text-3xl font-bold tracking-widest uppercase sm:text-5xl">
          POOLS
        </h1>
        <Image src="/quest/header-quest-bg.png" alt="Header" width={200} height={200}
          className="absolute inset-0 left-0 z-[-1] h-full w-full" />
      </div>

      {/* Main Content */}
      <div className="relative mb-6 h-full min-h-[500px]">
        <Image src="/quest/Quest-BG.png" alt="BG" width={200} height={200}
          className="absolute inset-0 z-0 h-full w-full object-fill" />

        {/* Tabs */}
        <div className="relative z-50 mt-12 flex justify-center gap-4 px-4 pt-3">
          <button className={tabClass("pools")} onClick={() => setActiveTab("pools")}>
            <Droplets className="mr-2 inline h-5 w-5" /> POOLS
          </button>
          <button className={tabClass("add")} onClick={() => setActiveTab("add")}>
            <Plus className="mr-2 inline h-5 w-5" /> ADD
          </button>
          <button className={tabClass("remove")} onClick={() => { setActiveTab("remove"); }}>
            <Minus className="mr-2 inline h-5 w-5" /> REMOVE
          </button>
        </div>

        <div className="relative z-10 mx-auto mt-4 mb-8 w-[90%] p-4">
          {!isConnected ? (
            <div className="flex flex-col items-center gap-6 py-12">
              <Image src="/profile/Wallet.png" alt="Wallet" width={64} height={64} className="h-16 w-16 opacity-60" />
              <p className="font-family-ThaleahFat text-peach-300 text-center text-2xl tracking-wider">
                CONNECT WALLET TO VIEW POOLS
              </p>
              <div className="moleswap-pools-connect">
                <PushUniversalAccountButton />
              </div>
            </div>
          ) : !contractsDeployed ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <p className="font-family-ThaleahFat text-peach-300 text-center text-2xl tracking-wider">
                AMM CONTRACTS NOT YET DEPLOYED
              </p>
              <p className="font-family-ThaleahFat text-center text-base text-gray-400">
                Set NEXT_PUBLIC_AMM_FACTORY and NEXT_PUBLIC_AMM_ROUTER in .env.local after deploying UniswapV2 contracts on PushChain.
              </p>
              <p className="font-family-ThaleahFat text-center text-sm text-gray-500">
                RPC: https://evm.donut.rpc.push.org/ • Chain ID: {PUSHCHAIN_CHAIN_ID}
              </p>
            </div>
          ) : activeTab === "pools" ? (
            <PoolsList pools={pools} loading={loading} onRefresh={fetchPools} onSelect={(p) => { setSelectedPool(p); setActiveTab("remove"); }} />
          ) : activeTab === "add" ? (
            <AddLiquidityForm address={address!} onSuccess={fetchPools} />
          ) : (
            <RemoveLiquidityForm pool={selectedPool} pools={pools} address={address!} onSuccess={fetchPools} />
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// Pools List
// ============================================
const PoolsList = ({ pools, loading, onRefresh, onSelect }: {
  pools: Pool[]; loading: boolean; onRefresh: () => void; onSelect: (p: Pool) => void;
}) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <p className="font-family-ThaleahFat text-peach-300 text-xl tracking-wider">
        LIQUIDITY POOLS ({pools.length})
      </p>
      <button onClick={onRefresh} className="text-peach-300 cursor-pointer transition-all hover:scale-110">
        <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>

    {loading ? (
      <div className="py-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-yellow-100 border-t-transparent" />
        <p className="font-family-ThaleahFat text-peach-300 mt-4 text-xl">Loading pools...</p>
      </div>
    ) : pools.length === 0 ? (
      <div className="py-12 text-center">
        <p className="font-family-ThaleahFat text-xl text-gray-400">No pools found on-chain</p>
        <p className="font-family-ThaleahFat mt-2 text-sm text-gray-500">Create the first pool by adding liquidity!</p>
      </div>
    ) : (
      pools.map((pool) => (
        <button key={pool.pairAddress} onClick={() => onSelect(pool)}
          className="relative w-full cursor-pointer px-6 py-4 text-left transition-all hover:scale-[1.01]">
          <Image src="/quest/header-quest-bg.png" alt="BG" width={200} height={200}
            className="absolute inset-0 left-0 z-[-1] h-full w-full" />
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-family-ThaleahFat text-xl tracking-wider text-white">
                {pool.token0.symbol} / {pool.token1.symbol}
              </h3>
              <p className="font-family-ThaleahFat text-sm text-gray-400">
                Reserves: {parseFloat(pool.reserve0).toFixed(4)} / {parseFloat(pool.reserve1).toFixed(4)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-family-ThaleahFat text-peach-300 text-lg">{pool.userShare}%</p>
              <p className="font-family-ThaleahFat text-sm text-gray-400">Your share</p>
              {parseFloat(pool.userLiquidity) > 0 && (
                <p className="font-family-ThaleahFat text-xs text-gray-500">LP: {parseFloat(pool.userLiquidity).toFixed(6)}</p>
              )}
            </div>
          </div>
        </button>
      ))
    )}
  </div>
);

// ============================================
// Add Liquidity Form
// ============================================
const AddLiquidityForm = ({ address, onSuccess }: { address: string; onSuccess: () => void }) => {
  const [tokenA, setTokenA] = useState("");
  const [tokenB, setTokenB] = useState("");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!tokenA || !tokenB || !amountA || !amountB) return;
    setLoading(true);
    setError("");
    setTxHash("");
    try {
      const result = await addLiquidity({
        tokenA, tokenB, amountA, amountB, recipient: address,
      });
      if (result.success) {
        setTxHash(result.txHash);
        onSuccess();
        setAmountA("");
        setAmountB("");
      } else {
        setError("Transaction failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to add liquidity");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="font-family-ThaleahFat text-peach-300 text-xl tracking-wider">ADD LIQUIDITY</p>

      <TokenInput label="TOKEN A ADDRESS" value={tokenA} onChange={setTokenA} placeholder="0x..." />
      <AmountInput label="AMOUNT A" value={amountA} onChange={setAmountA} />

      <div className="flex justify-center">
        <div className="border-ground-button-border bg-ground-button flex h-10 w-10 items-center justify-center rounded-full border-2">
          <Plus className="text-peach-300 h-5 w-5" />
        </div>
      </div>

      <TokenInput label="TOKEN B ADDRESS" value={tokenB} onChange={setTokenB} placeholder="0x..." />
      <AmountInput label="AMOUNT B" value={amountB} onChange={setAmountB} />

      {error && <p className="font-family-ThaleahFat text-center text-red-400">{error}</p>}
      {txHash && (
        <p className="font-family-ThaleahFat text-center text-green-400">
          Success! TX: {txHash.slice(0, 10)}...
        </p>
      )}

      <button onClick={handleAdd} disabled={loading || !tokenA || !tokenB || !amountA || !amountB}
        className="font-family-ThaleahFat w-full cursor-pointer rounded-lg bg-[#6DBB3E] px-6 py-4 text-2xl tracking-wider text-white shadow-[0px_-4px_0px_0px_#4A8B29_inset,0px_4px_0px_0px_rgba(255,255,255,0.3)_inset] transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50">
        {loading ? "ADDING..." : "ADD LIQUIDITY"}
      </button>
    </div>
  );
};

// ============================================
// Remove Liquidity Form
// ============================================
const RemoveLiquidityForm = ({ pool, pools, address, onSuccess }: {
  pool: Pool | null; pools: Pool[]; address: string; onSuccess: () => void;
}) => {
  const [selectedPair, setSelectedPair] = useState<Pool | null>(pool);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const userPools = pools.filter((p) => parseFloat(p.userLiquidity) > 0);

  const handleRemove = async () => {
    if (!selectedPair || !amount) return;
    setLoading(true);
    setError("");
    setTxHash("");
    try {
      const result = await removeLiquidity({
        tokenA: selectedPair.token0.address,
        tokenB: selectedPair.token1.address,
        liquidity: amount,
        recipient: address,
      });
      if (result.success) {
        setTxHash(result.txHash);
        onSuccess();
        setAmount("");
      } else {
        setError("Transaction failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to remove liquidity");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="font-family-ThaleahFat text-peach-300 text-xl tracking-wider">REMOVE LIQUIDITY</p>

      {userPools.length === 0 ? (
        <p className="font-family-ThaleahFat py-8 text-center text-gray-400">You have no liquidity positions to remove</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {userPools.map((p) => (
              <button key={p.pairAddress} onClick={() => setSelectedPair(p)}
                className={`relative cursor-pointer px-4 py-3 text-left transition-all ${
                  selectedPair?.pairAddress === p.pairAddress ? "ring-2 ring-yellow-400" : ""
                }`}>
                <Image src="/quest/header-quest-bg.png" alt="BG" width={200} height={200}
                  className="absolute inset-0 left-0 z-[-1] h-full w-full" />
                <span className="font-family-ThaleahFat text-lg text-white">
                  {p.token0.symbol}/{p.token1.symbol} — LP: {parseFloat(p.userLiquidity).toFixed(6)}
                </span>
              </button>
            ))}
          </div>

          {selectedPair && (
            <>
              <AmountInput label="LP TOKENS TO REMOVE" value={amount} onChange={setAmount}
                max={selectedPair.userLiquidity} />

              {error && <p className="font-family-ThaleahFat text-center text-red-400">{error}</p>}
              {txHash && <p className="font-family-ThaleahFat text-center text-green-400">Success! TX: {txHash.slice(0, 10)}...</p>}

              <button onClick={handleRemove} disabled={loading || !amount}
                className="font-family-ThaleahFat w-full cursor-pointer rounded-lg bg-[#C9432A] px-6 py-4 text-2xl tracking-wider text-white shadow-[0px_-4px_0px_0px_#8B2E1D_inset,0px_4px_0px_0px_rgba(255,255,255,0.3)_inset] transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? "REMOVING..." : "REMOVE LIQUIDITY"}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};

// ============================================
// Shared Components
// ============================================
const TokenInput = ({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) => (
  <div className="relative px-6 py-3">
    <Image src="/quest/header-quest-bg.png" alt="BG" width={200} height={200}
      className="absolute inset-0 left-0 z-[-1] h-full w-full" />
    <p className="font-family-ThaleahFat mb-1 text-sm text-gray-400">{label}</p>
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "0x..."}
      className="font-family-ThaleahFat w-full bg-transparent text-lg tracking-wider text-white placeholder:text-gray-600 focus:outline-none" />
  </div>
);

const AmountInput = ({ label, value, onChange, max }: {
  label: string; value: string; onChange: (v: string) => void; max?: string;
}) => (
  <div className="relative px-6 py-3">
    <Image src="/quest/header-quest-bg.png" alt="BG" width={200} height={200}
      className="absolute inset-0 left-0 z-[-1] h-full w-full" />
    <div className="flex items-center justify-between">
      <p className="font-family-ThaleahFat text-sm text-gray-400">{label}</p>
      {max && (
        <button onClick={() => onChange(max)} className="font-family-ThaleahFat cursor-pointer text-xs text-yellow-400 hover:underline">
          MAX
        </button>
      )}
    </div>
    <input type="text" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
      placeholder="0.0"
      className="font-family-ThaleahFat w-full bg-transparent text-2xl tracking-wider text-white placeholder:text-gray-600 focus:outline-none" />
  </div>
);
