"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, Fuel } from "lucide-react";
import { DappStep } from ".";
import Image from "next/image";
import { relayClient } from "@/lib/relay/client";
import { getWalletClient } from "@/lib/wallet/walletClient";
import type { RelayCurrency, RelayChain } from "@/lib/relay/api";

interface SwapPageProps {
  onNext: (step: DappStep, data?: any) => void;
  onBack: () => void;
  swapData: {
    quote: any;
    fromToken: string;
    toToken: string;
    amount: string;
    expectedOut: string;
    fromTokenMeta?: RelayCurrency;
    toTokenMeta?: RelayCurrency;
    fromChain?: RelayChain;
    toChain?: RelayChain;
    routeLabel?: string;
    feesLabel?: string;
    etaSeconds?: number;
    rateLabel?: string;
    walletAddress?: string | null;
  };
  onSwapStart?: () => void; // Called when swap execution starts (after wallet approval)
  onSwapComplete?: () => void; // Called when swap completes
}

export const SwapPage = ({
  onNext,
  onBack,
  swapData,
  onSwapStart,
  onSwapComplete,
}: SwapPageProps) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [requireApproval, setRequireApproval] = useState<boolean | null>(null);

  // Compute input amount in wei for exact-amount approval when needed
  const amountWei = useMemo(() => {
    const decimals = swapData.fromTokenMeta?.decimals ?? 18;
    const amount = swapData.amount;
    if (!amount) return "";
    try {
      const [ints, frac = ""] = amount.split(".");
      const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
      const normalized =
        `${BigInt(ints || "0").toString()}${fracPadded}`.replace(/^0+/, "");
      return normalized || "0";
    } catch {
      return "";
    }
  }, [swapData.amount, swapData.fromTokenMeta?.decimals]);

  // Detect if approval is needed from quote steps
  const approvalInfo = useMemo(() => {
    const steps = swapData.quote?.steps;
    if (!Array.isArray(steps)) return null;
    // Heuristics to find an approval step
    const approveStep = steps.find((s: any) => {
      const name = (s?.name || s?.description || "").toString().toLowerCase();
      const type = (s?.type || s?.operation || "").toString().toLowerCase();
      const data =
        s?.transaction?.data || s?.tx?.data || s?.request?.data || "";
      return (
        name.includes("approv") ||
        type.includes("approv") ||
        (typeof data === "string" && data.startsWith("0x095ea7b3"))
      );
    });
    if (!approveStep) return null;
    // Try to extract spender from step; fallback to route/quote details
    const spender =
      approveStep?.spender ||
      approveStep?.to ||
      swapData.quote?.details?.spender ||
      swapData.quote?.spender;
    const token = swapData.fromTokenMeta?.address || swapData.fromToken;
    return spender && token ? { token, spender } : null;
  }, [
    swapData.quote?.steps,
    swapData.fromTokenMeta?.address,
    swapData.fromToken,
    swapData.quote?.details?.spender,
    swapData.quote?.spender,
  ]);

  const needsApproval = Boolean(approvalInfo);

  // Helper: wait for a tx receipt to be mined
  const waitForReceipt = async (txHash: string, timeoutMs = 90000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        const receipt = await (window as any)?.ethereum?.request?.({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });
        if (receipt && receipt.blockNumber) return receipt;
      } catch {}
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error("Approval transaction not confirmed in time");
  };

  const handleStartSwapping = async () => {
    if (!swapData.quote) {
      setExecutionError("No quote available");
      return;
    }

    setIsExecuting(true);
    setIsCompleted(false);
    setExecutionError(null);
    setTxHashes([]);
    setCurrentStep(null);

    try {
      // Get expected chain ID from the quote
      const expectedChainId = swapData.fromChain?.id
        ? Number(swapData.fromChain.id)
        : undefined;

      if (!expectedChainId) {
        throw new Error("Unable to determine expected chain ID from quote.");
      }

      const wallet = await getWalletClient();
      if (!wallet) {
        throw new Error("No wallet available. Please connect your wallet.");
      }

      // Get the current account and chain from the wallet
      const accounts = await wallet.getAddresses();
      const currentAddress = accounts?.[0];

      if (!currentAddress) {
        throw new Error(
          "No wallet account available. Please connect your wallet.",
        );
      }

      // Check current chain ID and switch if needed
      try {
        const currentChainId = await wallet.getChainId();
        if (currentChainId !== expectedChainId) {
          // Try to switch chain
          try {
            await wallet.switchChain({ id: expectedChainId });
            // Wait a moment for chain switch to complete
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (switchError: any) {
            // If switch fails, try to add chain first (for testnets/new chains)
            if (
              switchError?.code === 4902 ||
              switchError?.message?.includes("Unrecognized chain")
            ) {
              throw new Error(
                `Please switch your wallet to chain ${expectedChainId} (${swapData.fromChain?.displayName || swapData.fromChain?.name || "Unknown"}) manually.`,
              );
            }
            throw new Error(
              `Failed to switch to chain ${expectedChainId}: ${switchError?.message || "Unknown error"}`,
            );
          }
        }
      } catch (chainError: any) {
        // If we can't get/switch chain, show user-friendly error
        throw new Error(
          `Chain mismatch. Please ensure your wallet is connected to ${swapData.fromChain?.displayName || swapData.fromChain?.name || `chain ${expectedChainId}`}. ${chainError?.message || ""}`,
        );
      }

      // Burn addresses to check against
      const burnAddresses = [
        "0x000000000000000000000000000000000000dead",
        "0xdead000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
      ];
      const isBurnAddr = (addr: string) =>
        burnAddresses.some((ba) => addr?.toLowerCase() === ba.toLowerCase());

      // Validate address is not a burn address
      if (isBurnAddr(currentAddress)) {
        throw new Error(
          "Invalid wallet address. Please connect a valid wallet.",
        );
      }

      // Clone quote and recursively replace all burn addresses with user's address
      const quote = JSON.parse(JSON.stringify(swapData.quote)); // Deep clone

      // Recursively replace all burn addresses in the quote object
      const replaceBurnAddresses = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;

        if (typeof obj === "string") {
          // Replace string if it's a burn address
          return isBurnAddr(obj) ? currentAddress : obj;
        }

        if (Array.isArray(obj)) {
          return obj.map((item) => replaceBurnAddresses(item));
        }

        if (typeof obj === "object") {
          const result: any = {};
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              const value = obj[key];

              // Special handling for common address fields
              if (
                (key.toLowerCase().includes("sender") ||
                  key.toLowerCase().includes("from") ||
                  key.toLowerCase().includes("user") ||
                  key.toLowerCase().includes("account")) &&
                typeof value === "string" &&
                isBurnAddr(value)
              ) {
                result[key] = currentAddress;
              } else if (typeof value === "string" && isBurnAddr(value)) {
                // Replace any string that matches burn address
                result[key] = currentAddress;
              } else {
                result[key] = replaceBurnAddresses(value);
              }
            }
          }
          return result;
        }

        return obj;
      };

      // Replace all burn addresses recursively
      const cleanedQuote = replaceBurnAddresses(quote);
      // Remove approval step from the quote so execute doesn't prompt a second, limited approval
      const isApprovalStep = (s: any) => {
        const name = (s?.name || s?.description || "").toString().toLowerCase();
        const type = (s?.type || s?.operation || "").toString().toLowerCase();
        const data =
          s?.transaction?.data || s?.tx?.data || s?.request?.data || "";
        return (
          name.includes("approv") ||
          type.includes("approv") ||
          (typeof data === "string" && data.startsWith("0x095ea7b3"))
        );
      };
      const filteredQuote = {
        ...cleanedQuote,
        steps: Array.isArray(cleanedQuote?.steps)
          ? cleanedQuote.steps.filter((s: any) => !isApprovalStep(s))
          : cleanedQuote?.steps,
      };

      // Debug: verify no burn addresses remain
      const quoteString = JSON.stringify(cleanedQuote);
      const hasBurnAddr = burnAddresses.some((ba) =>
        quoteString.toLowerCase().includes(ba.toLowerCase()),
      );
      if (hasBurnAddr) {
        // eslint-disable-next-line no-console
        console.warn("Warning: Burn address still found in cleaned quote");
      }

      // eslint-disable-next-line no-console
      console.log("Using cleaned quote with address:", currentAddress);

      let finalTxHashes: string[] = [];
      let hasStarted = false;
      // If approval is indicated by quote, verify on-chain allowance first
      if (needsApproval && approvalInfo) {
        try {
          const walletForCheck = await getWalletClient();
          if (!walletForCheck) throw new Error("No wallet available.");
          // ERC20 allowance(owner, spender)
          const erc20AllowanceAbi = [
            {
              type: "function",
              name: "allowance",
              stateMutability: "view",
              inputs: [
                { name: "owner", type: "address" },
                { name: "spender", type: "address" },
              ],
              outputs: [{ name: "remaining", type: "uint256" }],
            },
          ] as const;
          const currentAllowance = await (walletForCheck as any).readContract({
            address: approvalInfo.token as `0x${string}`,
            abi: erc20AllowanceAbi as any,
            functionName: "allowance",
            args: [currentAddress, approvalInfo.spender],
          });
          const allowanceBn = BigInt(
            currentAllowance?.toString?.() ?? currentAllowance ?? 0,
          );
          const needed =
            amountWei && amountWei !== "" ? BigInt(amountWei) : BigInt(0);
          if (allowanceBn >= needed) {
            setRequireApproval(false);
          } else {
            setRequireApproval(true);
          }
        } catch {
          // if allowance check fails, fall back to requiring approval
          setRequireApproval(true);
        }
      }

      // If approval required, perform it first and wait for confirmation
      if (
        needsApproval &&
        approvalInfo &&
        (requireApproval === null || requireApproval === true)
      ) {
        try {
          setApproving(true);
          const walletForApprove = await getWalletClient();
          if (!walletForApprove)
            throw new Error("No wallet available for approval.");
          // minimal ERC20 ABI for approve
          const erc20ApproveAbi = [
            {
              type: "function",
              name: "approve",
              stateMutability: "nonpayable",
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              outputs: [{ name: "", type: "bool" }],
            },
          ] as const;
          // Use decimal BigInt via constructor to avoid literal/exponentiation target issues
          const MAX_UINT256 = BigInt(
            "115792089237316195423570985008687907853269984665640564039457584007913129639935",
          );
          const hash = await (walletForApprove as any).writeContract({
            address: approvalInfo.token as `0x${string}`,
            abi: erc20ApproveAbi as any,
            functionName: "approve",
            // Always approve unlimited to avoid repeated approvals on future swaps
            args: [approvalInfo.spender, MAX_UINT256],
          });
          setApprovalHash(typeof hash === "string" ? hash : hash?.hash || null);
          if (typeof hash === "string") {
            await waitForReceipt(hash);
          } else if (hash?.hash) {
            await waitForReceipt(hash.hash);
          }
        } finally {
          setApproving(false);
        }
      }

      await relayClient.actions.execute({
        quote: filteredQuote,
        wallet,
        onProgress: ({
          steps,
          fees,
          breakdown,
          currentStep: step,
          currentStepItem,
          txHashes: hashes,
          details,
        }) => {
          // eslint-disable-next-line no-console
          console.log("Swap progress:", {
            steps,
            fees,
            breakdown,
            currentStep: step,
            currentStepItem,
            txHashes: hashes,
            details,
          });

          // Start animation after first transaction is sent (wallet approval happened)
          // Animation will keep looping until swap completes
          if (!hasStarted && hashes && hashes.length > 0) {
            hasStarted = true;
            onSwapStart?.(); // Trigger background animation (will loop until onSwapComplete)
          }

          // Silently track txHashes during execution (don't show status)
          if (hashes && hashes.length > 0) {
            // Extract txHash strings from objects or use strings directly
            const hashStrings = hashes
              .map((h: any) =>
                typeof h === "string" ? h : h.txHash || h.hash || h,
              )
              .filter(Boolean);
            // Filter out approval hash if present so only swap tx is recorded
            const filtered = approvalHash
              ? hashStrings.filter(
                  (h: string) => h.toLowerCase() !== approvalHash.toLowerCase(),
                )
              : hashStrings;
            finalTxHashes = filtered;
            setTxHashes(filtered);
          }
        },
      });

      // Execute promise has resolved - swap is complete
      // Stop animation and navigate to transaction-info immediately
      setIsExecuting(false);
      setIsCompleted(true);
      onSwapComplete?.(); // Stop background animation

      // Navigate to transaction-info page immediately after swap completes
      onNext("transaction-info", {
        transactionId:
          finalTxHashes?.[finalTxHashes.length - 1] ||
          txHashes[txHashes.length - 1] ||
          "",
        txHashes: finalTxHashes.length > 0 ? finalTxHashes : txHashes,
      });
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error("Swap execution error:", error);
      setExecutionError(error?.message || "Failed to execute swap");
      setIsExecuting(false);
      setIsCompleted(false);
      onSwapComplete?.(); // Stop animation on error
    }
  };

  const fromLogo =
    swapData.fromTokenMeta?.logoURI ||
    swapData.fromChain?.iconUrl ||
    swapData.fromChain?.logoUrl ||
    "/placeholder-logo.png";
  const toLogo =
    swapData.toTokenMeta?.logoURI ||
    swapData.toChain?.iconUrl ||
    swapData.toChain?.logoUrl ||
    "/placeholder-logo.png";

  return (
    <div className="flex w-full flex-1 flex-col p-2 sm:max-w-3xl sm:p-6">
      {/* Header with Back Button */}
      <div className="font-family-ThaleahFat relative top-[40px] z-10 mx-auto flex w-[85%] items-center justify-center rounded-lg px-6 py-4 text-center">
        <button
          onClick={onBack}
          className="border-ground-button-border bg-ground-button absolute left-4 cursor-pointer justify-center rounded border-2 p-1 text-yellow-100 hover:scale-105"
        >
          <ArrowLeft className="h-6 w-6 text-yellow-100" />
        </button>

        <h1 className="text-peach-300 text-shadow-header mx-auto text-3xl font-bold tracking-widest uppercase sm:text-5xl">
          Exchange
        </h1>
        <Image
          src="/quest/header-quest-bg.png"
          alt="Profile"
          width={200}
          height={200}
          className="absolute inset-0 left-0 z-[-1] h-full w-full"
        />
      </div>
      <div className="relative mb-6 block h-full">
        <Image
          src="/quest/Quest-BG.png"
          alt="Profile"
          width={200}
          height={200}
          className="absolute inset-0 z-0 h-full w-full object-fill"
        />
        <div className="relative z-50 mx-auto mt-12 mb-6 grid w-full grid-cols-1 gap-4 p-4 sm:w-[85%]">
          {/* Swap Details */}
          <div className="relative mb-6 space-y-4 p-4">
            <Image
              src="/dapp/start-swaping-info-box.png"
              alt="Profile"
              width={200}
              height={200}
              className="absolute inset-0 left-0 z-[-1] h-full w-full"
            />
            {/* From Token */}
            <div className="px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="border-ground-button-border bg-ground-button mr-3 flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border-2">
                    <Image
                      src={fromLogo}
                      alt="From token"
                      width={40}
                      height={40}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="font-family-ThaleahFat text-3xl text-zinc-100">
                      {swapData.amount || "0"}
                    </div>
                    <div className="text-sm font-semibold text-stone-300">
                      {swapData.fromTokenMeta?.symbol || swapData.fromToken} on{" "}
                      {swapData.fromChain?.displayName ||
                        swapData.fromChain?.name ||
                        "Unknown"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-yellow-100">
                    ETA:{" "}
                    {(swapData.etaSeconds ?? null) !== null
                      ? `${swapData.etaSeconds}s`
                      : "-"}
                  </div>
                </div>
              </div>
            </div>

            {/* Swap Via */}
            <div className="px-4">
              <div className="flex items-center">
                <div className="border-ground-button-border bg-ground-button mr-3 flex h-10 w-10 items-center justify-center rounded-lg border-2 p-4">
                  <span className="font-bold text-white">🔄</span>
                </div>
                <div>
                  <div className="font-family-ThaleahFat text-2xl text-zinc-100">
                    {swapData.routeLabel || "AUTO ROUTE"}
                  </div>
                </div>
                <div className="ml-auto">
                  <button className="border-ground-button-border bg-ground-button cursor-pointer justify-center rounded border-2 p-1 text-yellow-100 hover:scale-105">
                    <ArrowDown className="z-10 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* To Token */}
            <div className="px-4">
              <div className="flex items-center">
                <div className="border-ground-button-border bg-ground-button mr-3 flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border-2">
                  <Image
                    src={toLogo}
                    alt="To token"
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-family-ThaleahFat text-3xl text-zinc-100">
                    {swapData.expectedOut || "0"}
                  </div>
                  <div className="text-sm font-semibold text-stone-300">
                    {swapData.feesLabel || ""} •{" "}
                    {swapData.toTokenMeta?.symbol || swapData.toToken} on{" "}
                    {swapData.toChain?.displayName ||
                      swapData.toChain?.name ||
                      "Unknown"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Fee */}
          <div className="relative z-50 p-4">
            <div className="flex w-full justify-between gap-4 px-4 py-1 max-sm:flex-col sm:items-center">
              <div className="text-sm font-semibold text-stone-300">
                {swapData.rateLabel ||
                  `1 ${swapData.fromTokenMeta?.symbol || swapData.fromToken} = ${swapData.expectedOut || "0"} ${swapData.toTokenMeta?.symbol || swapData.toToken}`}
              </div>
              <div className="ml-auto text-sm text-yellow-200">
                <Fuel className="inline-block h-4 w-4" />{" "}
                {swapData.feesLabel || "<$0.01"} ETA:{" "}
                {(swapData.etaSeconds ?? null) !== null
                  ? `${swapData.etaSeconds}s`
                  : "-"}
              </div>
            </div>
            <Image
              src="/quest/header-quest-bg.png"
              alt="Profile"
              width={200}
              height={200}
              className="absolute inset-0 left-0 z-[-1] h-full w-full"
            />
          </div>

          {/* Execution Status - Show during approval/swap phases */}
          {isExecuting && (
            <div className="relative z-50 rounded-lg bg-black/40 p-4 text-center">
              <div className="text-sm text-yellow-200">
                {approving
                  ? "Waiting for approval confirmation..."
                  : "Executing swap... (Animation running)"}{" "}
                <span className="text-[#BCBCBC]">
                  • ETA:{" "}
                  {(swapData.etaSeconds ?? null) !== null
                    ? `${swapData.etaSeconds}s`
                    : "-"}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {executionError && (
            <div className="relative z-50 rounded-lg bg-red-900/40 p-4 text-center text-sm text-red-200">
              Error: {executionError}
            </div>
          )}
          {/* Start Swapping Button */}
          <button
            onClick={handleStartSwapping}
            disabled={isExecuting || !swapData.quote}
            className="relative w-full cursor-pointer rounded py-4 text-xl font-bold text-white transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>
              {isExecuting
                ? approving
                  ? "APPROVING..."
                  : "SWAPPING..."
                : needsApproval
                  ? "APPROVE"
                  : "START SWAPPING"}
            </span>
            <Image
              src="/dapp/connect-wallet.png"
              alt="Profile"
              width={200}
              height={200}
              className="absolute inset-0 z-[-1] h-full w-full object-fill"
            />
          </button>
        </div>
      </div>
    </div>
  );
};
