"use client";
import { useState, useEffect, useRef } from "react";
import { BackgroundImage, NavBar } from "../shared";
import { ExchangePage } from "./ExchangePage";
import { SwapPage } from "./SwapPage";
import { TransactionInfoPage } from "./TransactionInfoPage";
import { SwapSuccessPage } from "./SwapSuccessPage";
import { LottieRefCurrentProps } from "lottie-react";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import Image from "next/image";

export type DappStep = "exchange" | "swap" | "transaction-info" | "success";

export default function DappPage() {
  const [currentStep, setCurrentStep] = useState<DappStep>("exchange");
  const [swapData, setSwapData] = useState<any>({
    fromToken: "",
    toToken: "",
    amount: "",
    expectedOut: "",
    transactionId: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Simulate loading during swap process
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isLoading) {
      // Reset progress when loading starts
      setProgress(0);

      // Simulate 15-second loading process
      const totalTime = 5000; // 15 seconds
      const intervalTime = 50; // Update every 50ms
      const increment = (intervalTime / totalTime) * 100;

      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsLoading(false);
            // Move to success page when loading completes
            setCurrentStep("success");
            return 100;
          }
          return prev + increment;
        });
      }, intervalTime);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  const handleStepChange = (step: DappStep, data?: any) => {
    if (data) {
      setSwapData((prev: any) => ({ ...prev, ...data }));
    }

    // Don't auto-start animation when navigating to swap step
    // Animation will start when user approves swap in wallet
    if (step === "success") {
      setIsLoading(false);
      setProgress(0);
    }

    setCurrentStep(step);
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "exchange":
        return <ExchangePage onNext={handleStepChange} />;
      case "swap":
        return (
          <SwapPage
            onNext={handleStepChange}
            onBack={() => setCurrentStep("exchange")}
            swapData={swapData}
            onSwapStart={() => setIsLoading(true)}
            onSwapComplete={() => setIsLoading(false)}
          />
        );
      case "transaction-info":
        return (
          <TransactionInfoPage
            onNext={handleStepChange}
            onBack={() => setCurrentStep("swap")}
            swapData={swapData}
          />
        );
      case "success":
        return (
          <SwapSuccessPage onNext={handleStepChange} swapData={swapData} />
        );
      default:
        return <ExchangePage onNext={handleStepChange} />;
    }
  };

  const lottieRef = useRef<LottieRefCurrentProps>(null);
  useEffect(() => {
    if (isLoading && lottieRef.current) {
      // Start the animation - it will loop automatically based on loop prop in BackgroundImage
      lottieRef.current.setSpeed(1); // Normal speed
      lottieRef.current.goToAndPlay(0, true); // Start from beginning, loop is handled by the loop prop
    } else if (!isLoading && lottieRef.current) {
      // Stop the animation when swap completes
      lottieRef.current.stop(); // Stop animation
    }
  }, [isLoading]);
  // console.log("progress", progress);
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center gap-4">
      <BackgroundImage isLoading={isLoading} ref={lottieRef} />

      <div className="relative z-50 mx-auto mt-4 flex w-auto gap-3 px-2 py-2 max-lg:w-full max-sm:flex-col-reverse sm:gap-6 sm:px-4">
        <NavBar />
        <div className="bg-peach-500 font-family-ThaleahFat relative flex w-full items-center justify-center rounded-lg border-3 border-[#523525] text-lg font-medium tracking-wider text-black shadow-[0px_-6px_0px_0px_#C97E00_inset,0px_7.5px_0px_0px_rgba(255,212,122,0.6)_inset] sm:max-w-3xl sm:justify-between sm:text-2xl">
          <ConnectWalletButton />
        </div>
      </div>
      {/* BANnER IMAGE   */}
      <Image
        src="/dapp/banner.svg"
        alt="Profile"
        width={100}
        height={20}
        className="z-10 mt-8 mb-[-50px] h-auto w-auto"
      />

      <div className="relative z-20 mb-[40%] flex w-full flex-1 items-center justify-center sm:mb-[8%]">
        {renderCurrentStep()}
      </div>
    </div>
  );
}
