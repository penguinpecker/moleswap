"use client";
import {
  ArrowDown,
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Fuel,
} from "lucide-react";
import { DappStep } from ".";
import Image from "next/image";

interface TransactionInfoPageProps {
  onNext: (step: DappStep, data?: any) => void;
  onBack: () => void;
  swapData: any;
}

export const TransactionInfoPage = ({
  onNext,
  onBack,
  swapData,
}: TransactionInfoPageProps) => {
  const handleContactSupport = () => {
    // Simulate transaction completion
    setTimeout(() => {
      onNext("success");
    }, 1000);
  };

  const copyTransactionId = () => {
    const txId =
      swapData.transactionId ||
      (swapData.txHashes && swapData.txHashes.length > 0
        ? swapData.txHashes[swapData.txHashes.length - 1]
        : "");
    if (txId) {
      navigator.clipboard.writeText(txId);
    }
  };

  const openTransactionExplorer = () => {
    const txId =
      swapData.transactionId ||
      (swapData.txHashes && swapData.txHashes.length > 0
        ? swapData.txHashes[swapData.txHashes.length - 1]
        : "");
    if (txId) {
      // Determine chain explorer based on toChain
      const chainId = swapData.toChain?.id || 1; // Default to Ethereum mainnet
      let explorerUrl = `https://etherscan.io/tx/${txId}`;

      if (chainId === 8453) {
        explorerUrl = `https://basescan.org/tx/${txId}`;
      } else if (chainId === 42161) {
        explorerUrl = `https://arbiscan.io/tx/${txId}`;
      } else if (chainId === 10) {
        explorerUrl = `https://optimistic.etherscan.io/tx/${txId}`;
      } else if (chainId === 137) {
        explorerUrl = `https://polygonscan.com/tx/${txId}`;
      } else if (chainId === 56) {
        explorerUrl = `https://bscscan.com/tx/${txId}`;
      }

      window.open(explorerUrl, "_blank", "noopener,noreferrer");
    }
  };

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
          TXN INFO
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
          className="absolute inset-0 z-[-1] h-full w-full object-fill"
        />
        <div className="relative z-50 mx-auto mt-12 mb-6 grid w-full grid-cols-1 gap-4 p-4 sm:w-[85%]">
          <div className="relative mb-2 space-y-4 p-4">
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
                      src={
                        swapData.fromTokenMeta?.logoURI ||
                        swapData.fromChain?.iconUrl ||
                        swapData.fromChain?.logoUrl ||
                        "/placeholder-logo.png"
                      }
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
                    ETA: {swapData.etaSeconds ? `${swapData.etaSeconds}s` : "-"}
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
            {/* Status Indicators */}
            <div className="flex justify-between gap-4 px-4">
              <div className="flex items-center">
                <span className="mr-2">
                  <Image
                    src="/dapp/Check-mark.png"
                    alt="Profile"
                    width={40}
                    height={40}
                  />
                </span>
                <span className="text-sm font-semibold text-[#9AEC32]">
                  CHAIN SWITCHED
                </span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">
                  <Image
                    src="/dapp/Check-mark.png"
                    alt="Profile"
                    width={40}
                    height={40}
                  />
                </span>
                <span className="text-sm font-semibold text-[#9AEC32]">
                  SWAP COMPLETED
                </span>
              </div>
            </div>
            {/* To Token */}
            <div className="px-4">
              <div className="flex items-center">
                <div className="border-ground-button-border bg-ground-button mr-3 flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border-2">
                  <Image
                    src={
                      swapData.toTokenMeta?.logoURI ||
                      swapData.toChain?.iconUrl ||
                      swapData.toChain?.logoUrl ||
                      "/placeholder-logo.png"
                    }
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
          <div className="relative z-50 mb-6 p-4">
            <div className="flex w-full justify-between gap-4 px-4 py-1 max-sm:flex-col sm:items-center">
              <div className="text-sm font-semibold text-stone-300">
                {swapData.rateLabel ||
                  `1 ${swapData.fromTokenMeta?.symbol || swapData.fromToken} = ${swapData.expectedOut || "0"} ${swapData.toTokenMeta?.symbol || swapData.toToken}`}
              </div>
              <div className="ml-auto text-sm text-yellow-200">
                <Fuel className="inline-block h-4 w-4" />{" "}
                {swapData.feesLabel || "<$0.01"} ETA:{" "}
                {swapData.etaSeconds ? `${swapData.etaSeconds}s` : "-"}
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

          {/* Transaction ID */}
          <div className="relative z-50 mb-2 p-4">
            <div className="relative flex w-full items-center justify-between gap-4 px-4 py-1">
              <label className="bg-ground-button-border font-family-ThaleahFat text-peach-300 absolute top-[-2rem] left-4 mb-2 block px-2 text-2xl uppercase">
                TRANSFER ID
              </label>
              <div className="absolute top-[-2rem] right-4 flex items-center gap-2">
                <button
                  onClick={copyTransactionId}
                  className="bg-ground-button-border ml-2 p-2"
                >
                  <Copy className="h-4 w-4 text-yellow-100" />
                </button>
                <button
                  onClick={openTransactionExplorer}
                  className="bg-ground-button-border ml-2 p-2 hover:opacity-80"
                >
                  <ExternalLink className="h-4 w-4 text-yellow-100" />
                </button>
              </div>
              <div className="my-4 flex flex-1 items-center font-mono text-sm break-all text-yellow-100">
                {swapData.transactionId ||
                  (swapData.txHashes && swapData.txHashes.length > 0
                    ? swapData.txHashes[swapData.txHashes.length - 1]
                    : "No transaction ID")}
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
          {/* Contact Support Button */}
          <button
            onClick={handleContactSupport}
            className="relative z-50 w-full cursor-pointer rounded py-4 text-xl font-bold text-white transition-all hover:scale-105"
          >
            <span> CONTACT SUPPORT</span>
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
