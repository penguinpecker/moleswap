"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUpDown, Fuel, Search } from "lucide-react";
import { DappStep } from ".";
import Image from "next/image";
import { getChains, getTokensForChain, type RelayChain } from "@/lib/relay/api";
import { relayClient } from "@/lib/relay/client";
import { usePushWallet } from "@/lib/pushchain/provider";
import { getTokenBalance } from "@/lib/wallet/walletClient";
import { useRouter } from "next/navigation";
import type { Address } from "viem";
import Settings from "../settings";

interface ExchangePageProps {
  onNext: (step: DappStep, data?: any) => void;
}

type SelectionMode = "none" | "from" | "to";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const ExchangePage = ({ onNext }: ExchangePageProps) => {
  const router = useRouter();
  const pushWallet = usePushWallet();

  // ----- Original state (kept) -----
  const [fromToken, setFromToken] = useState(""); // address
  const [toToken, setToToken] = useState(""); // address
  const [amount, setAmount] = useState(""); // human amount
  const [showReceive, setShowReceive] = useState(false);

  const [chains, setChains] = useState<RelayChain[]>([]);
  const [fromChainId, setFromChainId] = useState<string>("");
  const [toChainId, setToChainId] = useState<string>("");

  const [loadingChains, setLoadingChains] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [quoteRefreshing, setQuoteRefreshing] = useState(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState<number | null>(null);
  const [ttlLeft, setTtlLeft] = useState<number>(0);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [fromTokenBalance, setFromTokenBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState<string | null>(null);
  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  // Store balances for tokens in the selection modal: key = "chainId-tokenAddress"
  const [tokenBalances, setTokenBalances] = useState<
    Record<string, string | null>
  >({});
  const [loadingBalances, setLoadingBalances] = useState<
    Record<string, boolean>
  >({});
  // Track which balances have been requested to avoid duplicate fetches
  const fetchedBalancesRef = useRef<Set<string>>(new Set());

  // ----- UI state for modal selector -----
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchQueryNetwork, setSearchQueryNetwork] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<string>(""); // temp network while selecting

  const [showSettings, setShowSettings] = useState(false);
  // ----- Load chains (kept) -----
  useEffect(() => {
    setLoadingChains(true);
    getChains()
      .then((c) => {
        setChains(c);
        if (c[0]) {
          setFromChainId(String(c[0].id));
          setToChainId(String(c[0].id));
          const nativeAddr =
            c[0].currency?.address ||
            "0x0000000000000000000000000000000000000000";
          setFromToken(nativeAddr);
          setToToken(nativeAddr);
        }
      })
      .finally(() => setLoadingChains(false));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync wallet address from PushChain context
  useEffect(() => {
    if (pushWallet.isConnected && pushWallet.address && !walletAddress) {
      setWalletAddress(pushWallet.address);
      setRecipientAddress(pushWallet.address);
    }
    if (!pushWallet.isConnected && walletAddress) {
      setWalletAddress(null);
      setRecipientAddress(null);
    }
  }, [pushWallet.isConnected, pushWallet.address]);

  // ----- Check for existing wallet connection on mount -----
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (typeof window === "undefined") return;

      // Check MetaMask / injected provider
      const eth = window.ethereum;
      if (eth?.request) {
        try {
          const accounts: string[] = await eth.request({
            method: "eth_accounts",
          });
          if (accounts?.[0]) {
            setWalletAddress(accounts[0]);
            setRecipientAddress(accounts[0]); // Initialize recipient to wallet address
            setShowReceive(true);
          }
        } catch (e) {
          // Silently fail if wallet is not connected
        }
      }

      // Listen for account changes
      if (eth?.on) {
        const onAccountsChanged = (accounts: string[]) => {
          if (accounts?.[0]) {
            setWalletAddress(accounts[0]);
            setRecipientAddress(accounts[0]); // Update recipient when wallet changes
            setShowReceive(true);
          } else {
            setWalletAddress(null);
            setRecipientAddress(null);
            setShowReceive(false);
            setFromTokenBalance(null);
          }
        };
        eth.on("accountsChanged", onAccountsChanged);

        return () => {
          eth.removeListener?.("accountsChanged", onAccountsChanged);
        };
      }
    };

    checkWalletConnection();
  }, []);

  // ----- Listen for WalletConnect events -----
  useEffect(() => {
    const setupWalletConnect = async () => {
      try {
        const { getWalletConnectProvider } = await import(
          "@/lib/wallet/walletconnect/provider"
        );
        const provider = await getWalletConnectProvider();
        if (provider) {
          // Listen for account changes from WalletConnect
          provider.on("accountsChanged", (accounts: string[]) => {
            if (accounts?.[0]) {
              setWalletAddress(accounts[0]);
              setRecipientAddress(accounts[0]);
              setShowReceive(true);
            } else {
              setWalletAddress(null);
              setRecipientAddress(null);
              setShowReceive(false);
            }
          });

          // Listen for disconnect events from WalletConnect
          provider.on("disconnect", () => {
            setWalletAddress(null);
            setRecipientAddress(null);
            setShowReceive(false);
            setFromTokenBalance(null);
          });

          // Listen for chain changes
          provider.on("chainChanged", () => {
            // Chain changed, but wallet is still connected
            // Optionally refresh chain-specific data here
          });

          // Check if already connected via WalletConnect
          if (provider.accounts && provider.accounts.length > 0) {
            setWalletAddress(provider.accounts[0]);
            setRecipientAddress(provider.accounts[0]);
            setShowReceive(true);
          }
        }
      } catch (error) {
        // Provider might not be initialized yet, that's okay
      }
    };

    setupWalletConnect();
  }, []);

  // ----- Listen for custom wallet disconnect event -----
  useEffect(() => {
    const handleWalletDisconnect = () => {
      setWalletAddress(null);
      setRecipientAddress(null);
      setShowReceive(false);
      setFromTokenBalance(null);
    };

    window.addEventListener("walletDisconnected", handleWalletDisconnect);
    return () => {
      window.removeEventListener("walletDisconnected", handleWalletDisconnect);
    };
  }, []);

  // ----- Listen for custom wallet connection event from ConnectWalletButton -----
  useEffect(() => {
    const handleWalletConnected = (event: Event) => {
      const customEvent = event as CustomEvent<{ address: string }>;
      if (customEvent.detail?.address) {
        setWalletAddress(customEvent.detail.address);
        setRecipientAddress(customEvent.detail.address);
        setShowReceive(true);
      }
    };

    window.addEventListener("walletConnected", handleWalletConnected);
    return () => {
      window.removeEventListener("walletConnected", handleWalletConnected);
    };
  }, []);

  // ----- Derived chain/token lists (kept) -----
  const fromChain = useMemo(
    () => chains.find((c) => String(c.id) === fromChainId),
    [chains, fromChainId],
  );
  const toChain = useMemo(
    () => chains.find((c) => String(c.id) === toChainId),
    [chains, toChainId],
  );

  const fromTokens = useMemo(
    () => (fromChain ? getTokensForChain(fromChain) : []),
    [fromChain],
  );
  const toTokens = useMemo(
    () => (toChain ? getTokensForChain(toChain) : []),
    [toChain],
  );

  const fromTokenMeta = useMemo(
    () =>
      fromTokens.find(
        (t) => t.address?.toLowerCase() === fromToken.toLowerCase(),
      ),
    [fromTokens, fromToken],
  );
  const toTokenMeta = useMemo(
    () =>
      toTokens.find((t) => t.address?.toLowerCase() === toToken.toLowerCase()),
    [toTokens, toToken],
  );

  // ----- Amount -> wei (kept) -----
  const amountWei = useMemo(() => {
    const decimals = fromTokenMeta?.decimals ?? 18;
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
  }, [amount, fromTokenMeta]);

  // ----- Can quote (kept) -----
  const canQuote = useMemo(() => {
    return Boolean(
      fromChainId &&
        toChainId &&
        fromToken &&
        toToken &&
        amountWei &&
        amountWei !== "0",
    );
  }, [fromChainId, toChainId, fromToken, toToken, amountWei]);

  // ----- Fetch quote (kept) -----
  const fetchQuote = useMemo(
    () => async () => {
      if (!canQuote) {
        setQuote(null);
        return;
      }
      setQuoteRefreshing(true);
      try {
        // Check if this is a wrap operation (native to wrapped native on same chain)
        // Relay API requires user and recipient to match for wrap operations
        const nativeAddress = "0x0000000000000000000000000000000000000000";
        const fromTokenLower = fromToken?.toLowerCase() || "";
        const isFromNative =
          !fromToken ||
          fromToken === "" ||
          fromTokenLower === nativeAddress ||
          fromTokenLower === "native" ||
          fromTokenLower === "eth" ||
          fromTokenLower === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

        const isSameChain = fromChainId === toChainId;
        // If same chain and from native token, likely a wrap operation
        // Also check if toToken is a wrapped version (has a contract address)
        const toTokenLower = toToken?.toLowerCase() || "";
        const isToWrapped =
          toToken &&
          toTokenLower !== nativeAddress &&
          toTokenLower !== "" &&
          toTokenLower !== "native" &&
          toTokenLower !== "eth";

        const isWrapOperation =
          isSameChain && isFromNative && isToWrapped && walletAddress;

        // For wrap operations (ETH to WETH), user and recipient MUST match
        // For other operations, use recipient address or fallback to wallet address
        const finalRecipient = isWrapOperation
          ? walletAddress
          : recipientAddress || walletAddress;

        // Ensure user and recipient match for wrap operations
        const finalUser = walletAddress || undefined;
        const finalRecipientForQuote = isWrapOperation
          ? finalUser // Force recipient to match user for wraps
          : finalRecipient;

        const q = await relayClient.actions.getQuote(
          {
            chainId: Number(fromChainId),
            toChainId: Number(toChainId),
            currency: fromToken,
            toCurrency: toToken,
            amount: amountWei,
            tradeType: "EXACT_INPUT",
            user: finalUser,
            recipient: finalRecipientForQuote || undefined,
          },
          true,
        );
        // eslint-disable-next-line no-console
        console.log("Relay getQuote response", q);
        // eslint-disable-next-line no-console
        console.log("Quote fees structure:", JSON.stringify(q?.fees, null, 2));
        // eslint-disable-next-line no-console
        console.log(
          "Quote details structure:",
          JSON.stringify(q?.details, null, 2),
        );
        setQuote(q);
        setQuoteUpdatedAt(Date.now());
      } catch (e: any) {
        // Log error for debugging
        const errorMessage = e?.message || String(e);
        console.error("Error fetching quote:", errorMessage);

        // If it's a wrap operation error, provide helpful message
        if (
          errorMessage.includes("USER_RECIPIENT_MISMATCH") ||
          errorMessage.includes("user and recipient must match")
        ) {
          console.warn(
            "Wrap operation detected: user and recipient must match. " +
              "Using wallet address as recipient.",
          );
        }

        setQuote(null);
      } finally {
        setQuoteRefreshing(false);
      }
    },
    [
      canQuote,
      fromChainId,
      toChainId,
      fromToken,
      toToken,
      amountWei,
      walletAddress,
      recipientAddress,
    ],
  );

  useEffect(() => {
    // Initial fetch when inputs change
    fetchQuote();
    // Reset refresh timer
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (canQuote) {
      refreshTimerRef.current = setInterval(() => {
        fetchQuote();
      }, 25000); // refresh ~25s
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchQuote, canQuote]);

  // ----- TTL (kept) -----
  useEffect(() => {
    const id = setInterval(() => {
      if (!quoteUpdatedAt) return setTtlLeft(0);
      const elapsed = Math.floor((Date.now() - quoteUpdatedAt) / 1000);
      const left = Math.max(0, 30 - elapsed);
      setTtlLeft(left);
    }, 1000);
    return () => clearInterval(id);
  }, [quoteUpdatedAt]);

  // ----- Helpers from original (kept) -----
  const formatTokenAmount = (
    wei: string | undefined,
    decimals: number | undefined,
  ) => {
    if (!wei || !decimals) return "-";
    try {
      const s = wei.toString();
      const pad = decimals - Math.min(decimals, s.length);
      const full = pad > 0 ? "0".repeat(pad) + s : s;
      const i = full.slice(0, full.length - decimals) || "0";
      const f = full.slice(-decimals).replace(/0+$/, "");
      return f ? `${i}.${f}` : i;
    } catch {
      return "-";
    }
  };

  const expectedOutWei = useMemo(() => {
    if (!quote) return undefined;
    return (
      quote.toAmount ||
      quote.expectedOutput ||
      quote.output?.amount ||
      quote.amountOut ||
      quote.details?.toAmount ||
      quote.details?.to?.amount ||
      quote.details?.currencyOut?.amount ||
      quote.steps?.[0]?.toAmount ||
      quote.steps?.[0]?.to?.amount ||
      quote.steps?.[0]?.outputAmount
    );
  }, [quote]);

  const expectedOut = useMemo(
    () => formatTokenAmount(expectedOutWei, toTokenMeta?.decimals),
    [expectedOutWei, toTokenMeta?.decimals],
  );

  const routeLabel = useMemo(() => {
    if (quote?.route?.name) return quote.route.name;
    if (Array.isArray(quote?.sources) && quote.sources.length) {
      return quote.sources.map((s: any) => s?.name || s).join(" → ");
    }
    if (Array.isArray(quote?.steps) && quote.steps.length) {
      return quote.steps
        .map((s: any) => s?.name || s?.source || "")
        .filter(Boolean)
        .join(" → ");
    }
    return undefined;
  }, [quote]);

  const feesLabel = useMemo(() => {
    if (!quote) return undefined;
    let usd =
      quote?.feesUsd ??
      quote?.totalFeesUsd ??
      quote?.fees?.totalUsd ??
      quote?.fees?.usd ??
      quote?.breakdown?.totalUsd ??
      quote?.totalUsd;
    if (!usd && quote?.fees) {
      if (Array.isArray(quote.fees.breakdown)) {
        usd = quote.fees.breakdown.reduce(
          (acc: number, f: any) => acc + Number(f?.usd || f?.usdValue || 0),
          0,
        );
      } else if (typeof quote.fees === "object") {
        for (const k of Object.keys(quote.fees)) {
          const v = (quote.fees as any)[k];
          if (k.toLowerCase().includes("usd") && typeof v === "number") {
            usd = v;
            break;
          }
        }
      }
    }
    if (!usd && Array.isArray(quote?.steps)) {
      usd = quote.steps.reduce(
        (acc: number, s: any) =>
          acc + Number(s?.fees?.usd || s?.fees?.totalUsd || 0),
        0,
      );
    }
    if (!usd && typeof quote?.details?.fees === "object") {
      usd = quote.details.fees.usd || quote.details.fees.totalUsd;
    }
    return usd ? `$${Number(usd).toFixed(2)} fees` : undefined;
  }, [quote]);
  const etaSeconds = useMemo(() => {
    const direct =
      quote?.estimatedTimeSeconds ??
      quote?.etaSeconds ??
      quote?.durationSeconds ??
      quote?.details?.etaSeconds;
    if (direct) return direct;
    const detailsEta = (quote as any)?.details?.eta?.seconds;
    if (detailsEta) return detailsEta;
    if (Array.isArray(quote?.steps)) {
      let eta: number | undefined;
      for (const s of quote.steps) {
        const sEta = s?.etaSeconds ?? s?.durationSeconds ?? s?.eta?.seconds;
        if (sEta && (!eta || sEta > eta)) eta = sEta;
        if (Array.isArray(s?.items)) {
          for (const it of s.items) {
            const iEta =
              it?.etaSeconds ?? it?.durationSeconds ?? it?.eta?.seconds;
            if (iEta && (!eta || iEta > eta)) eta = iEta;
          }
        }
      }
      return eta;
    }
    return undefined;
  }, [quote]);
  const rateLabel = useMemo(() => {
    try {
      if (
        !expectedOutWei ||
        !amountWei ||
        !fromTokenMeta?.decimals ||
        !toTokenMeta?.decimals
      )
        return undefined;
      const fromPow = Math.pow(10, fromTokenMeta.decimals);
      const toPow = Math.pow(10, toTokenMeta.decimals);
      const outNum = Number(expectedOutWei);
      const inNum = Number(amountWei);
      if (!isFinite(outNum) || !isFinite(inNum) || inNum === 0)
        return undefined;
      const rate = outNum / toPow / (inNum / fromPow);
      if (!isFinite(rate)) return undefined;
      return `1 ${fromTokenMeta.symbol} = ${(rate * 1).toFixed(6)} ${toTokenMeta.symbol}`;
    } catch {
      return undefined;
    }
  }, [
    expectedOutWei,
    amountWei,
    fromTokenMeta?.decimals,
    toTokenMeta?.decimals,
    fromTokenMeta?.symbol,
    toTokenMeta?.symbol,
  ]);

  // Calculate USD value of balance from quote price
  const balanceUsdValue = useMemo(() => {
    if (!fromTokenBalance || !quote || !amountWei) return null;

    try {
      // Try to get USD value from various quote fields
      const inputUsd =
        quote?.fromAmountUsd ??
        quote?.inputUsd ??
        quote?.amountInUsd ??
        quote?.details?.fromAmountUsd ??
        quote?.details?.inputUsd;

      if (inputUsd && amountWei) {
        // Calculate price per token
        const fromPow = Math.pow(10, fromTokenMeta?.decimals ?? 18);
        const amountNum = Number(amountWei) / fromPow;

        if (amountNum > 0) {
          const pricePerToken = Number(inputUsd) / amountNum;
          const balanceNum = Number(fromTokenBalance);
          return balanceNum * pricePerToken;
        }
      }

      // Fallback: try to calculate from output USD if available
      const outputUsd =
        quote?.toAmountUsd ??
        quote?.outputUsd ??
        quote?.amountOutUsd ??
        quote?.details?.toAmountUsd ??
        quote?.details?.outputUsd;

      if (outputUsd && amountWei && expectedOutWei) {
        const fromPow = Math.pow(10, fromTokenMeta?.decimals ?? 18);
        const toPow = Math.pow(10, toTokenMeta?.decimals ?? 18);
        const amountNum = Number(amountWei) / fromPow;
        const outputNum = Number(expectedOutWei) / toPow;

        if (amountNum > 0 && outputNum > 0) {
          // Calculate exchange rate and infer input USD from output USD
          const exchangeRate = outputNum / amountNum;
          const inputUsdFromOutput = Number(outputUsd) / exchangeRate;
          const pricePerToken = inputUsdFromOutput / amountNum;
          const balanceNum = Number(fromTokenBalance);
          return balanceNum * pricePerToken;
        }
      }

      return null;
    } catch {
      return null;
    }
  }, [
    fromTokenBalance,
    quote,
    amountWei,
    expectedOutWei,
    fromTokenMeta?.decimals,
    toTokenMeta?.decimals,
  ]);

  const shortAddress = (addr?: string | null) => {
    if (!addr) return "";
    return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
  };

  const formatWalletAddress = (addr?: string | null) => {
    if (!addr) return "";
    return `${addr.slice(0, 4)}***${addr.slice(-3)}`;
  };

  const isValidAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  const handleRecipientAddressChange = (value: string) => {
    setRecipientAddress(value);
  };

  const handleRecipientAddressBlur = () => {
    if (recipientAddress && !isValidAddress(recipientAddress)) {
      // Reset to wallet address if invalid
      setRecipientAddress(walletAddress);
    }
    setIsEditingRecipient(false);
  };

  const handleRecipientAddressKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      handleRecipientAddressBlur();
    } else if (e.key === "Escape") {
      setRecipientAddress(walletAddress);
      setIsEditingRecipient(false);
    }
  };

  const fromLogo = useMemo(
    () =>
      fromTokenMeta?.logoURI ||
      fromChain?.iconUrl ||
      fromChain?.logoUrl ||
      "/placeholder-logo.png",
    [fromTokenMeta?.logoURI, fromChain?.iconUrl, fromChain?.logoUrl],
  );
  const toLogo = useMemo(
    () =>
      toTokenMeta?.logoURI ||
      toChain?.iconUrl ||
      toChain?.logoUrl ||
      "/placeholder-logo.png",
    [toTokenMeta?.logoURI, toChain?.iconUrl, toChain?.logoUrl],
  );

  const handleConnectWallet = async () => {
    try {
      // PushChain universal wallet connection (primary)
      pushWallet.connect();
    } catch (e) {
      // optional toast
    }
  };

  // Helper functions to set amount based on balance percentage
  const setAmountPercentage = (percentage: number) => {
    if (!fromTokenBalance) return;
    const balanceNum = Number(fromTokenBalance);
    if (isNaN(balanceNum) || balanceNum <= 0) return;

    const calculatedAmount = (balanceNum * percentage).toString();
    // Format to avoid too many decimal places
    const decimals = fromTokenMeta?.decimals ?? 18;
    const maxDecimals = Math.min(decimals, 6);
    const formatted = Number(calculatedAmount).toFixed(maxDecimals);
    setAmount(formatted.replace(/\.?0+$/, "")); // Remove trailing zeros
  };

  const handleSet20Percent = () => setAmountPercentage(0.2);
  const handleSet50Percent = () => setAmountPercentage(0.5);
  const handleSetMax = () => {
    if (!fromTokenBalance) return;
    const balanceNum = Number(fromTokenBalance);
    if (isNaN(balanceNum) || balanceNum <= 0) return;

    const decimals = fromTokenMeta?.decimals ?? 18;
    const maxDecimals = Math.min(decimals, 6);
    const formatted = balanceNum.toFixed(maxDecimals);
    setAmount(formatted.replace(/\.?0+$/, "")); // Remove trailing zeros
  };

  const handleReviewSwap = () => {
    if (!quote) {
      // eslint-disable-next-line no-console
      console.warn("No quote available to review");
      return;
    }
    onNext("swap", {
      quote,
      fromToken: fromToken || "ETH",
      toToken: toToken || "USDC",
      amount: amount || "0",
      expectedOut: expectedOut || "0",
      fromTokenMeta,
      toTokenMeta,
      fromChain,
      toChain,
      routeLabel: routeLabel || "Auto",
      feesLabel: feesLabel || "-",
      etaSeconds: typeof etaSeconds === "number" ? etaSeconds : undefined,
      rateLabel: rateLabel || "-",
      walletAddress,
      recipientAddress: recipientAddress || walletAddress,
    });
  };

  // ----- Show Receive automatically when ready (kept) -----
  // Note: showReceive is now primarily controlled by wallet connection
  // This effect ensures receive panel shows when all conditions are met
  useEffect(() => {
    if (walletAddress && fromToken && toToken && Number(amount) > 0) {
      setShowReceive(true);
    } else if (!walletAddress) {
      setShowReceive(false);
    }
  }, [walletAddress, fromToken, toToken, amount]);

  // ----- Fetch balance when wallet, chain, and token are selected -----
  useEffect(() => {
    let cancelled = false;

    const fetchBalance = async () => {
      if (!walletAddress || !fromChainId || !fromToken) {
        if (!cancelled) {
          setFromTokenBalance(null);
          setBalanceLoading(false);
        }
        return;
      }

      // Set loading immediately when conditions are met
      if (!cancelled) {
        setBalanceLoading(true);
      }

      try {
        // Get the chain to access vmType
        const chain = chains.find((c) => String(c.id) === fromChainId);
        const vmType = chain?.vmType;

        const balance = await getTokenBalance(
          walletAddress as Address,
          fromToken,
          Number(fromChainId),
          fromTokenMeta?.decimals,
          vmType,
        );

        if (!cancelled) {
          setFromTokenBalance(balance);
          setBalanceLoading(false);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch balance:", error);
        if (!cancelled) {
          setFromTokenBalance(null);
          setBalanceLoading(false);
        }
      }
    };

    // Start fetching immediately (no delay for initial load)
    fetchBalance();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, fromChainId, fromToken, fromTokenMeta?.decimals, chains]);

  // ----- Modal select logic -----
  // open modal: seed selectedNetwork with current chain for side
  const openSelect = (mode: SelectionMode) => {
    setSelectionMode(mode);
    setSearchQuery("");
    setSearchQueryNetwork("");
    if (mode === "from") {
      setSelectedNetwork(fromChainId || "");
    } else if (mode === "to") {
      setSelectedNetwork(toChainId || "");
    } else {
      setSelectedNetwork("");
    }
  };

  const handleBackToExchange = () => {
    setSelectionMode("none");
    setSearchQuery("");
    setSearchQueryNetwork("");
    setSelectedNetwork("");
  };

  // List of networks filtered by search
  const filteredNetworks = useMemo(() => {
    return chains.filter((net) =>
      (net.displayName || net.name || "")
        .toLowerCase()
        .includes(searchQueryNetwork.toLowerCase()),
    );
  }, [chains, searchQueryNetwork]);

  // Tokens for the currently selected network in the modal
  const modalChain =
    chains.find((c) => String(c.id) === String(selectedNetwork)) || null;
  const modalTokens = useMemo(
    () => (modalChain ? getTokensForChain(modalChain) : []),
    [modalChain],
  );

  const filteredModalTokens = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return modalTokens.filter(
      (t) =>
        (t.symbol || "").toLowerCase().includes(q) ||
        (t.name || "").toLowerCase().includes(q),
    );
  }, [modalTokens, searchQuery]);

  // Fetch balances for all tokens in the selected network
  // Optimized to batch fetch and cache results (similar to relay-kit demo pattern)
  useEffect(() => {
    if (!walletAddress || !selectedNetwork || !modalChain) {
      // Reset fetched ref when conditions aren't met
      fetchedBalancesRef.current.clear();
      return;
    }

    let cancelled = false;

    const fetchTokenBalances = async () => {
      const chainId = Number(selectedNetwork);
      const vmType = modalChain.vmType;

      // Filter tokens that need balance fetching (not already cached, loading, or previously fetched)
      const tokensToFetch = filteredModalTokens.filter((token) => {
        const balanceKey = `${chainId}-${token.address}`;
        // Skip if already fetched, cached, or currently loading
        return (
          !fetchedBalancesRef.current.has(balanceKey) &&
          tokenBalances[balanceKey] === undefined &&
          !loadingBalances[balanceKey]
        );
      });

      if (tokensToFetch.length === 0) return;

      // Mark as fetched to prevent duplicate requests
      tokensToFetch.forEach((token) => {
        const balanceKey = `${chainId}-${token.address}`;
        fetchedBalancesRef.current.add(balanceKey);
      });

      // Mark all as loading
      setLoadingBalances((prev) => {
        const newState = { ...prev };
        tokensToFetch.forEach((token) => {
          const balanceKey = `${chainId}-${token.address}`;
          newState[balanceKey] = true;
        });
        return newState;
      });

      // Fetch balances for all tokens in parallel (batched)
      const balancePromises = tokensToFetch.map(async (token) => {
        if (cancelled) return null;

        const balanceKey = `${chainId}-${token.address}`;

        try {
          const balance = await getTokenBalance(
            walletAddress as Address,
            token.address,
            chainId,
            token.decimals,
            vmType,
          );

          if (!cancelled) {
            return { balanceKey, balance };
          }
        } catch (error) {
          if (!cancelled) {
            console.error(`Error fetching balance for ${token.symbol}:`, error);
            return { balanceKey, balance: null };
          }
        }
        return null;
      });

      const results = await Promise.all(balancePromises);

      if (!cancelled) {
        // Update all balances at once
        setTokenBalances((prev) => {
          const newState = { ...prev };
          results.forEach((result) => {
            if (result) {
              newState[result.balanceKey] = result.balance;
            }
          });
          return newState;
        });

        // Clear loading states
        setLoadingBalances((prev) => {
          const newState = { ...prev };
          tokensToFetch.forEach((token) => {
            const balanceKey = `${chainId}-${token.address}`;
            delete newState[balanceKey];
          });
          return newState;
        });
      }
    };

    // Small delay to debounce rapid network changes
    const timeoutId = setTimeout(() => {
      fetchTokenBalances();
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    walletAddress,
    selectedNetwork,
    modalChain?.id,
    modalChain?.vmType,
    filteredModalTokens.length,
  ]);

  // Reset fetched balances ref when network changes
  useEffect(() => {
    fetchedBalancesRef.current.clear();
  }, [selectedNetwork]);

  const handleSelectNetwork = (id: string) => {
    setSelectedNetwork(id);
  };

  const handleSelectToken = (tokenAddress: string) => {
    if (!selectedNetwork) return;
    if (selectionMode === "from") {
      setFromChainId(String(selectedNetwork));
      setFromToken(tokenAddress);
    } else if (selectionMode === "to") {
      setToChainId(String(selectedNetwork));
      setToToken(tokenAddress);
    }
    setSelectionMode("none");
    setSelectedNetwork("");
    setSearchQuery("");
    setSearchQueryNetwork("");
  };
  console.log(selectedNetwork, filteredModalTokens, fromToken, toToken);
  // ----- Selection UI (modal) -----
  if (selectionMode !== "none") {
    return (
      <div className="relative flex w-full flex-col justify-center gap-2 sm:flex-row sm:gap-4">
        {/* Token Panel */}
        <div className="flex w-full max-w-3xl flex-1 flex-col px-2 sm:p-6">
          <div className="relative z-10 mx-auto flex w-[90%] items-center justify-center rounded-lg px-3 py-2 text-center sm:w-[85%] sm:px-6 sm:py-4">
            <button
              onClick={handleBackToExchange}
              className="border-ground-button-border bg-ground-button absolute left-6 cursor-pointer justify-center rounded border-2 p-1 text-yellow-100 hover:scale-105"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-peach-300 font-family-ThaleahFat text-shadow-header text-xl font-bold tracking-widest uppercase sm:text-3xl lg:text-5xl">
              {selectionMode === "from" ? "FROM" : "TO"} TOKEN
            </h1>
            <Image
              src="/quest/header-quest-bg.png"
              alt="Header"
              width={200}
              height={200}
              className="absolute inset-0 left-0 z-[-1] h-full w-full"
            />
          </div>

          <div className="relative mb-6 block h-full">
            <Image
              src="/quest/Quest-BG.png"
              alt="BG"
              width={200}
              height={200}
              className="absolute inset-0 z-0 h-full w-full object-fill"
            />

            {/* Search Tokens */}
            <div className="relative z-10 mx-auto mt-12 mb-4 w-[85%]">
              <div className="relative flex items-center gap-3 px-6 py-4">
                <Search className="h-6 w-6 text-[#B0B0B0]" />
                <input
                  type="text"
                  placeholder="SEARCH BY TOKEN OR SYMBOL"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="font-family-ThaleahFat flex-1 bg-transparent text-lg tracking-widest text-white uppercase placeholder:text-[#8B8B8B] focus:outline-none"
                />
                <Image
                  src="/quest/header-quest-bg.png"
                  alt="BG"
                  width={200}
                  height={200}
                  className="absolute inset-0 left-0 z-[-1] h-full w-full"
                />
              </div>
            </div>

            {/* Token List for Selected Network */}
            <div className="relative z-10 mx-auto mb-4 w-full p-2 sm:w-[90%] sm:p-4">
              {/* <Image
                src="/dapp/exchange-token-bg.png"
                alt="BG"
                width={200}
                height={200}
                className="absolute inset-0 left-0 z-[-1] h-full w-full"
              /> */}
              <div className="hide-scrollbar relative flex max-h-[450px] flex-col gap-3 overflow-y-auto">
                {selectedNetwork ? (
                  filteredModalTokens.length > 0 ? (
                    filteredModalTokens.map((token, idx) => (
                      <button
                        key={`${token.address}-${idx}`}
                        onClick={() => handleSelectToken(token.address)}
                        className={`relative cursor-pointer px-6 py-4 text-left`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center justify-start gap-4">
                            <div className="border-ground-button-border h-14 w-14 overflow-hidden">
                              <Image
                                src={token.logoURI || "/placeholder-logo.png"}
                                alt={token.symbol || "token"}
                                width={56}
                                height={56}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="text-left">
                              <h2 className="font-family-ThaleahFat text-3xl tracking-widest text-white uppercase">
                                {token.symbol}
                              </h2>
                              <p className="font-family-ThaleahFat -mt-2 text-lg tracking-widest text-[#B0B0B0] uppercase">
                                {token.name}
                              </p>
                            </div>
                          </div>
                          {walletAddress && selectedNetwork && (
                            <div className="text-right">
                              {loadingBalances[
                                `${selectedNetwork}-${token.address}`
                              ] ? (
                                <span className="font-family-ThaleahFat text-base text-gray-400">
                                  Loading...
                                </span>
                              ) : (
                                <span className="font-family-ThaleahFat text-lg text-yellow-100">
                                  {tokenBalances[
                                    `${selectedNetwork}-${token.address}`
                                  ] !== null &&
                                  tokenBalances[
                                    `${selectedNetwork}-${token.address}`
                                  ] !== undefined
                                    ? Number(
                                        tokenBalances[
                                          `${selectedNetwork}-${token.address}`
                                        ] || 0,
                                      ).toLocaleString(undefined, {
                                        maximumFractionDigits: 6,
                                        minimumFractionDigits: 0,
                                      })
                                    : "-"}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <Image
                          src={`${
                            selectionMode === "from"
                              ? String(fromToken) === String(token.address)
                                ? "/dapp/selected-network-bg.png"
                                : "/quest/header-quest-bg.png"
                              : String(toToken) === String(token.address)
                                ? "/dapp/selected-network-bg.png"
                                : "/quest/header-quest-bg.png"
                          }`}
                          alt="BG"
                          width={200}
                          height={200}
                          className="absolute inset-0 left-0 z-[-1] h-full w-full"
                        />
                      </button>
                    ))
                  ) : (
                    <p className="font-family-ThaleahFat text-center text-xl text-gray-400">
                      No token found
                    </p>
                  )
                ) : (
                  <p className="font-family-ThaleahFat text-center text-xl text-gray-400">
                    Select a network first
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Network Panel */}
        <div className="flex w-full flex-col px-2 sm:max-w-xl sm:flex-1 sm:p-6">
          <div className="relative z-10 mx-auto w-[85%] rounded-lg px-6 py-4 text-center">
            <h1 className="text-peach-300 font-family-ThaleahFat text-shadow-header text-xl font-bold tracking-widest uppercase sm:text-3xl lg:text-5xl">
              NETWORK
            </h1>
            <Image
              src="/quest/header-quest-bg.png"
              alt="Header"
              width={200}
              height={200}
              className="absolute inset-0 left-0 z-[-1] h-full w-full"
            />
          </div>

          <div className="relative mb-6 block h-full">
            <Image
              src="/quest/Quest-BG.png"
              alt="BG"
              width={200}
              height={200}
              className="absolute inset-0 z-[-1] h-full w-full object-fill"
            />

            {/* Search Networks */}
            <div className="relative z-10 mx-auto mt-12 mb-4 w-[85%]">
              <div className="relative flex items-center gap-3 px-6 py-4">
                <Search className="h-6 w-6 text-[#B0B0B0]" />
                <input
                  type="text"
                  placeholder="SEARCH BY NETWORK"
                  value={searchQueryNetwork}
                  onChange={(e) => setSearchQueryNetwork(e.target.value)}
                  className="font-family-ThaleahFat flex-1 bg-transparent text-lg tracking-widest text-white uppercase placeholder:text-[#8B8B8B] focus:outline-none"
                />
                <Image
                  src="/quest/header-quest-bg.png"
                  alt="BG"
                  width={200}
                  height={200}
                  className="absolute inset-0 left-0 z-[-1] h-full w-full"
                />
              </div>
            </div>

            {/* Network List (with real logos) */}
            <div className="relative z-10 mx-auto mb-4 w-full p-4 sm:w-[90%]">
              {/* <Image
                src="/dapp/exchange-token-bg.png"
                alt="BG"
                width={200}
                height={200}
                className="absolute inset-0 left-0 z-[-1] h-full w-full"
              /> */}
              <div className="hide-scrollbar relative z-20 flex max-h-[450px] w-full flex-col gap-3 overflow-x-visible overflow-y-auto">
                {loadingChains ? (
                  <div className="relative flex h-screen w-full items-center justify-center">
                    <Image
                      src="/quest/Quest-BG.png"
                      alt="Background"
                      fill
                      className="absolute inset-0 z-[-1] h-full w-full object-fill"
                    />
                    <div className="z-10 flex flex-col items-center gap-4">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-yellow-100 border-t-transparent"></div>
                      <p className="font-family-ThaleahFat text-peach-300 text-xs tracking-wider uppercase sm:text-2xl sm:tracking-widest">
                        Loading Chains...
                      </p>
                    </div>
                  </div>
                ) : filteredNetworks.length > 0 ? (
                  filteredNetworks.map((network) => (
                    <button
                      key={network.id}
                      onClick={() => handleSelectNetwork(String(network.id))}
                      className={`relative cursor-pointer px-6 py-4 text-left`}
                    >
                      <div className="flex items-center justify-start gap-4 transition-all hover:scale-[1.02]">
                        <div className="border-ground-button-border h-12 w-12">
                          <Image
                            src={
                              network.iconUrl ||
                              network.logoUrl ||
                              "/placeholder-logo.png"
                            }
                            alt={network.displayName || network.name || "chain"}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="text-left">
                          <h2 className="font-family-ThaleahFat text-2xl tracking-widest text-white uppercase">
                            {network.displayName || network.name}
                          </h2>
                        </div>
                      </div>
                      <Image
                        src={
                          selectedNetwork === String(network.id)
                            ? "/dapp/selected-network-bg.png"
                            : "/quest/header-quest-bg.png"
                        }
                        alt="BG"
                        width={200}
                        height={200}
                        className="absolute inset-0 left-0 z-[-1] h-full w-full"
                      />
                    </button>
                  ))
                ) : (
                  <p className="font-family-ThaleahFat text-center text-xl text-gray-400">
                    No network found
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----- Main Exchange UI -----
  return (
    <>
      {showSettings ? (
        <Settings setShowSettings={setShowSettings} />
      ) : (
        <div className="relative flex w-full flex-col justify-center gap-2 sm:flex-row sm:gap-4">
          <div className="flex w-full max-w-3xl flex-1 flex-col px-2 sm:p-6">
            {/* Header */}
            <div className="relative z-10 mx-auto flex w-[90%] items-center justify-center rounded-lg px-3 py-2 text-center sm:w-[85%] sm:px-6 sm:py-4">
              <h1 className="text-peach-300 font-family-ThaleahFat text-shadow-header text-xl font-bold tracking-widest uppercase sm:text-3xl lg:text-5xl">
                EXCHANGE
              </h1>

              <button
                // onClick={() => router.push("/settings")}
                onClick={() => setShowSettings(true)}
                className="border-ground-button-border bg-ground-button absolute right-6 cursor-pointer justify-center rounded border-2 p-1 text-yellow-100 transition-all hover:scale-105"
              >
                <Image
                  src="/dapp/settings-icons.png"
                  alt="Settings"
                  width={200}
                  height={200}
                  className="h-6 w-6"
                />
              </button>

              <Image
                src="/quest/header-quest-bg.png"
                alt="Header BG"
                width={200}
                height={200}
                className="absolute inset-0 left-0 z-[-1] h-full w-full"
              />
            </div>

            {/* Body */}
            <div className="relative mb-6 block h-full">
              <Image
                src="/quest/Quest-BG.png"
                alt="BG"
                width={200}
                height={200}
                className="absolute inset-0 z-0 h-full w-full object-fill"
              />

              {/* Exchange Form */}
              <div className="relative z-50 mx-auto mt-4 mb-4 grid w-full grid-cols-1 gap-3 p-2 sm:mt-12 sm:mb-6 sm:gap-4 sm:p-4 sm:w-[85%]">
                {/* From */}
                <button
                  onClick={() => openSelect("from")}
                  className="relative z-10 mx-auto w-full cursor-pointer rounded-lg px-3 py-2 text-left transition-all hover:scale-[1.02] sm:px-6 sm:py-4 sm:text-center sm:w-[90%]"
                >
                  <div className="flex items-center justify-start gap-4">
                    <div className="border-ground-button-border h-8 w-8 overflow-hidden rounded-lg border-2 bg-black/50 sm:h-12 sm:w-12">
                      <Image
                        src={fromLogo}
                        alt="From"
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-family-ThaleahFat text-sm tracking-wider text-[#B0B0B0] uppercase sm:text-2xl sm:tracking-widest">
                          From
                        </h2>
                        {walletAddress && (
                          <p className="font-family-ThaleahFat text-peach-300 text-xs tracking-wider uppercase sm:text-2xl sm:tracking-widest">
                            {formatWalletAddress(walletAddress)}
                          </p>
                        )}
                      </div>
                      <p className="font-family-ThaleahFat text-sm font-bold tracking-wider text-[#EEEEEE] uppercase sm:text-xl lg:text-3xl truncate">
                        {fromChain?.displayName ||
                          fromChain?.name ||
                          "Select Network"}{" "}
                        / {fromTokenMeta?.symbol || "Select Token"}
                      </p>
                    </div>
                  </div>
                  <Image
                    src="/quest/header-quest-bg.png"
                    alt="BG"
                    width={200}
                    height={200}
                    className="absolute inset-0 left-0 z-[-1] h-full w-full"
                  />
                </button>

                {/* Swap Icon */}
                <div className="relative z-20 flex justify-center">
                  <button
                    onClick={() => {
                      const tempToken = fromToken;
                      const tempChain = fromChainId;
                      setFromToken(toToken);
                      setFromChainId(toChainId);
                      setToToken(tempToken);
                      setToChainId(tempChain);
                    }}
                    className="absolute inset-0 left-[50%] flex h-14 w-14 translate-x-[-50%] translate-y-[-50%] cursor-pointer items-center justify-center p-2 transition-all hover:scale-105"
                  >
                    <ArrowUpDown className="text-peach-300 h-6 w-6" />
                    <Image
                      src="/dapp/swap-button.png"
                      alt="Swap"
                      width={200}
                      height={200}
                      className="absolute inset-0 z-[-1] h-full w-full object-fill"
                    />
                  </button>
                </div>

                {/* To */}
                <div
                  onClick={() => openSelect("to")}
                  role="button"
                  tabIndex={0}
                  className="relative z-10 mx-auto w-full cursor-pointer rounded-lg px-3 py-2 text-left transition-all hover:scale-[1.02] sm:px-6 sm:py-4 sm:text-center sm:w-[90%]"
                >
                  <div className="flex items-center justify-start gap-4">
                    <div className="border-ground-button-border h-8 w-8 overflow-hidden rounded-lg border-2 bg-black/50 sm:h-12 sm:w-12">
                      <Image
                        src={toLogo}
                        alt="To"
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-family-ThaleahFat text-sm tracking-wider text-[#B0B0B0] uppercase sm:text-2xl sm:tracking-widest">
                          To
                        </h2>
                        {walletAddress && (
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isEditingRecipient ? (
                              <input
                                type="text"
                                value={recipientAddress || ""}
                                onChange={(e) =>
                                  handleRecipientAddressChange(e.target.value)
                                }
                                onBlur={handleRecipientAddressBlur}
                                onKeyDown={handleRecipientAddressKeyDown}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                placeholder="0x..."
                                className="font-family-ThaleahFat border-peach-300 text-peach-300 focus:ring-peach-300 w-48 rounded border bg-black/50 px-2 py-1 text-2xl tracking-widest uppercase focus:ring-1 focus:outline-none sm:w-64"
                                autoFocus
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsEditingRecipient(true);
                                }}
                                className="font-family-ThaleahFat text-peach-300 cursor-pointer text-2xl tracking-widest uppercase hover:underline"
                              >
                                {formatWalletAddress(
                                  recipientAddress || walletAddress,
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="font-family-ThaleahFat text-sm font-bold tracking-wider text-[#EEEEEE] uppercase sm:text-xl lg:text-3xl truncate">
                        {toChain?.displayName ||
                          toChain?.name ||
                          "Select Network"}{" "}
                        / {toTokenMeta?.symbol || "Select Token"}
                      </p>
                    </div>
                  </div>
                  <Image
                    src="/quest/header-quest-bg.png"
                    alt="BG"
                    width={200}
                    height={200}
                    className="absolute inset-0 left-0 z-[-1] h-full w-full"
                  />
                </div>

                {/* Amount */}
                <div className="relative z-10 mx-auto w-full rounded-lg px-6 py-4 text-center sm:w-[90%]">
                  <div className="flex items-center justify-start gap-4">
                    <div className="border-ground-button-border bg-ground-button h-8 w-8 rounded-lg border-2 p-2 sm:h-12 sm:w-12 sm:p-4"></div>
                    <div className="w-full text-left">
                      <h2 className="font-family-ThaleahFat text-sm tracking-wider text-[#B0B0B0] uppercase sm:text-2xl sm:tracking-widest">
                        Send
                      </h2>
                      <div className="font-family-ThaleahFat flex w-full items-center justify-between gap-2 text-base tracking-wider sm:text-2xl sm:tracking-widest uppercase">
                        <input
                          value={amount}
                          onChange={(e) =>
                            setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                          }
                          placeholder="0.0"
                          className="w-full bg-transparent text-white outline-none placeholder:text-[#aaa]"
                          inputMode="decimal"
                        />
                        <span className="text-peach-300">
                          {fromTokenMeta?.symbol ?? ""}
                        </span>
                      </div>
                      {/* Balance Display inside Send card */}
                      {walletAddress && fromToken && fromChainId && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex-1">
                            {balanceLoading ? (
                              <p className="font-family-ThaleahFat text-sm tracking-widest text-[#8B8B8B] uppercase">
                                Loading balance...
                              </p>
                            ) : fromTokenBalance ? (
                              <p className="font-family-ThaleahFat text-sm tracking-widest text-[#8B8B8B] uppercase">
                                Balance:{" "}
                                {Number(fromTokenBalance).toLocaleString(
                                  undefined,
                                  {
                                    maximumFractionDigits: 6,
                                    minimumFractionDigits: 0,
                                  },
                                )}{" "}
                                {fromTokenMeta?.symbol || ""}
                                {balanceUsdValue && (
                                  <span className="text-[#BCBCBC]">
                                    {" "}
                                    (${Number(balanceUsdValue).toFixed(2)})
                                  </span>
                                )}
                              </p>
                            ) : (
                              <p className="font-family-ThaleahFat text-sm tracking-widest text-[#8B8B8B] uppercase">
                                Unable to load balance
                              </p>
                            )}
                          </div>
                          {/* Helper buttons */}
                          {fromTokenBalance && !balanceLoading && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={handleSet20Percent}
                                className="font-family-ThaleahFat border-ground-button-border bg-ground-button hover:bg-opacity-80 cursor-pointer rounded border p-1 text-base tracking-widest text-yellow-100 uppercase transition-all hover:scale-105"
                              >
                                20%
                              </button>
                              <button
                                type="button"
                                onClick={handleSet50Percent}
                                className="font-family-ThaleahFat border-ground-button-border bg-ground-button hover:bg-opacity-80 cursor-pointer rounded border p-1 text-base tracking-widest text-yellow-100 uppercase transition-all hover:scale-105"
                              >
                                50%
                              </button>
                              <button
                                type="button"
                                onClick={handleSetMax}
                                className="font-family-ThaleahFat border-ground-button-border bg-ground-button hover:bg-opacity-80 cursor-pointer rounded border p-1 text-base tracking-widest text-yellow-100 uppercase transition-all hover:scale-105"
                              >
                                MAX
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Image
                    src="/quest/header-quest-bg.png"
                    alt="BG"
                    width={200}
                    height={200}
                    className="absolute inset-0 left-0 z-[-1] h-full w-full"
                  />
                </div>

                {/* Action Button (kept) */}
                {!walletAddress ? (
                  <button
                    onClick={handleConnectWallet}
                    className="relative w-full cursor-pointer rounded py-4 text-base font-bold text-white transition-all sm:text-xl hover:scale-105"
                  >
                    <span>CONNECT WALLET</span>
                    <Image
                      src="/dapp/connect-wallet.png"
                      alt="Connect"
                      width={200}
                      height={200}
                      className="absolute inset-0 z-[-1] h-full w-full object-fill"
                    />
                  </button>
                ) : (
                  <button
                    onClick={handleReviewSwap}
                    disabled={
                      !quote || !canQuote || !amount || Number(amount) <= 0
                    }
                    className="relative w-full cursor-pointer rounded py-4 text-base font-bold text-white transition-all sm:text-xl hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span> REVIEW SWAP </span>
                    <Image
                      src="/dapp/connect-wallet.png"
                      alt="Review"
                      width={200}
                      height={200}
                      className="absolute inset-0 z-[-1] h-full w-full object-fill"
                    />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Receive Panel (kept, auto-shows when ready) */}
          {showReceive && (
            <div className="flex w-full flex-col px-2 sm:max-w-xl sm:flex-1 sm:p-6">
              <div className="relative z-10 mx-auto w-[85%] rounded-lg px-6 py-4 text-center">
                <h1 className="text-peach-300 font-family-ThaleahFat text-shadow-header text-xl font-bold tracking-widest uppercase sm:text-3xl lg:text-5xl">
                  RECEIVE
                </h1>
                <Image
                  src="/quest/header-quest-bg.png"
                  alt="Header"
                  width={200}
                  height={200}
                  className="absolute inset-0 left-0 z-[-1] h-full w-full"
                />
              </div>
              <div className="relative mb-6 block h-full">
                <Image
                  src="/quest/Quest-BG.png"
                  alt="BG"
                  width={200}
                  height={200}
                  className="absolute inset-0 z-[-1] h-full w-full object-fill"
                />
                <div className="relative z-10 mx-auto mt-4 w-[95%] sm:mt-12 sm:w-[90%]">
                  {!quote ? (
                    <div className="rounded bg-black/40 p-4 text-sm text-[#BCBCBC]">
                      No quote yet. Select chains, tokens and amount.
                    </div>
                  ) : (
                    <div className="relative z-50 p-4">
                      <div className="flex w-full flex-col justify-between gap-4 py-1 sm:px-4">
                        <div className="flex items-center justify-between">
                          <div className="border-ground-button-border h-8 w-8 overflow-hidden rounded-lg border-2 bg-black/50 sm:h-12 sm:w-12">
                            <Image
                              src={toLogo}
                              alt="Receive Logo"
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="mr-auto ml-4 text-left">
                            <div className="font-family-ThaleahFat text-lg text-yellow-100 sm:text-3xl break-all">
                              {expectedOut || "-"}
                            </div>
                            <div className="text-sm font-semibold text-[#BCBCBC]">
                              <span>
                                {toTokenMeta?.symbol} on{" "}
                                {toChain?.displayName || toChain?.name}
                              </span>
                              {feesLabel ? (
                                <>
                                  {" "}
                                  • <span>{feesLabel}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                          <button className="border-ground-button-border bg-ground-button justify-center rounded border-2 p-1 text-yellow-100">
                            <ArrowDown className="z-10 h-4 w-4" />
                          </button>
                        </div>
                        <div className="bg-peach-500 h-[1px] w-full" />
                        <div className="space-y-1 text-left">
                          <div className="text-sm text-yellow-200">
                            <Fuel className="inline-block h-4 w-4" /> ETA:{" "}
                            {etaSeconds ? `${etaSeconds}s` : "-"} • Expires in:{" "}
                            {ttlLeft}s
                          </div>
                          <div className="text-xs font-semibold text-[#BCBCBC]">
                            {rateLabel ||
                              `From ${fromTokenMeta?.symbol} to ${toTokenMeta?.symbol}`}
                          </div>
                          {routeLabel && (
                            <div className="text-xs text-[#9a9a9a]">
                              Route: {routeLabel}
                            </div>
                          )}
                        </div>
                      </div>
                      <Image
                        src="/quest/header-quest-bg.png"
                        alt="BG"
                        width={200}
                        height={200}
                        className="absolute inset-0 left-0 z-[-1] h-full w-full"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
