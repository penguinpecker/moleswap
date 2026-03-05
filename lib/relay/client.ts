/**
 * Swap Client - Now uses PushChain AMM
 * Keeps relayClient export for backward compat
 */

import { getSwapQuote, executeSwap as pushExecuteSwap } from "@/lib/pushchain/amm";

export const relayClient = {
  actions: {
    getQuote: async (params: any) => {
      const quote = await getSwapQuote({
        tokenIn: params.currency || params.fromToken,
        tokenOut: params.toCurrency || params.toToken,
        amountIn: params.amount || "0",
      });
      return quote || {};
    },
    execute: async (params: any) => {
      // This is now handled via PushChain universal transactions
      // The SwapPage will be updated to use pushChainClient directly
      console.log("Swap execution now uses PushChain universal transactions");
      return {};
    },
  },
};

export type RelayClient = typeof relayClient;
