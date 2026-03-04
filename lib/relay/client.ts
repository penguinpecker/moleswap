import { createClient, MAINNET_RELAY_API, TESTNET_RELAY_API } from "@relayprotocol/relay-sdk";
import { RELAY_API } from "./api";

// Determine which API to use based on the RELAY_API constant
// This ensures consistency between API calls and client configuration
const isTestnet = RELAY_API.includes("testnet");

// Create a singleton Relay client at module load.
// Uses testnet API if testnet mode is detected, otherwise mainnet.
// Set a descriptive source for attribution/analytics.
export const relayClient = createClient({
  baseApiUrl: isTestnet ? TESTNET_RELAY_API : MAINNET_RELAY_API,
  source: process.env.NEXT_PUBLIC_RELAY_SOURCE || "swap-surge-play",
  // Optionally configure chains dynamically with configureDynamicChains()
});

export type RelayClient = typeof relayClient;


