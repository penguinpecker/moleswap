"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CONTRACTS: () => CONTRACTS,
  MoleSwap: () => MoleSwap,
  MoleSwapError: () => MoleSwapError,
  PUSHCHAIN_CHAIN_ID: () => PUSHCHAIN_CHAIN_ID,
  PUSHCHAIN_EXPLORER: () => PUSHCHAIN_EXPLORER,
  PUSHCHAIN_RPC: () => PUSHCHAIN_RPC,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var CONTRACTS = {
  FACTORY: "0x81b8Bca02580C7d6b636051FDb7baAC436bFb454",
  SWAP_ROUTER: "0x5D548bB9E305AAe0d6dc6e6fdc3ab419f6aC0037",
  QUOTER_V2: "0x83316275f7C2F79BC4E26f089333e88E89093037",
  POSITION_MANAGER: "0xf9b3ac66aed14A2C7D9AA7696841aB6B27a6231e",
  WPC: "0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9"
};
var PUSHCHAIN_RPC = "https://evm.donut.rpc.push.org/";
var PUSHCHAIN_CHAIN_ID = 2442;
var PUSHCHAIN_EXPLORER = "https://donut.push.network";
var MoleSwap = class {
  constructor(config) {
    if (typeof config === "string") {
      this.baseUrl = config.replace(/\/$/, "");
      this.timeout = 3e4;
    } else {
      this.baseUrl = config?.baseUrl?.replace(/\/$/, "") || "https://moleswap-eight.vercel.app";
      this.timeout = config?.timeout || 3e4;
    }
  }
  // ═══ INTERNAL FETCH ═══
  async request(path, options) {
    const url = `${this.baseUrl}/api/v1${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        method: options?.method || "GET",
        headers: options?.body ? { "Content-Type": "application/json" } : void 0,
        body: options?.body ? JSON.stringify(options.body) : void 0,
        signal: controller.signal
      });
      const json = await res.json();
      if (!json.success) {
        throw new MoleSwapError(
          json.error || "API request failed",
          res.status
        );
      }
      return json.data;
    } catch (err) {
      if (err instanceof MoleSwapError) throw err;
      if (err.name === "AbortError") {
        throw new MoleSwapError("Request timeout", 408);
      }
      throw new MoleSwapError(err.message || "Network error", 0);
    } finally {
      clearTimeout(timer);
    }
  }
  // ═══ READ ENDPOINTS ═══
  async getTokens(filters) {
    const params = new URLSearchParams();
    if (filters?.chain) params.set("chain", filters.chain);
    if (filters?.search) params.set("search", filters.search);
    const qs = params.toString();
    return this.request(`/tokens${qs ? `?${qs}` : ""}`);
  }
  async getPools(includeEmpty = false) {
    return this.request(`/pools${includeEmpty ? "?includeEmpty=true" : ""}`);
  }
  async getPool(address) {
    return this.request(`/pool/${address}`);
  }
  async getQuote(params) {
    const qs = new URLSearchParams({
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn
    });
    if (params.fee) qs.set("fee", params.fee.toString());
    return this.request(`/quote?${qs.toString()}`);
  }
  // ═══ TX BUILDER ENDPOINTS ═══
  async buildSwapTx(params) {
    return this.request("/tx/swap", { method: "POST", body: params });
  }
  async buildCreatePoolTx(params) {
    return this.request("/tx/create-pool", { method: "POST", body: params });
  }
  async buildAddLiquidityTx(params) {
    return this.request("/tx/add-liquidity", { method: "POST", body: params });
  }
  // ═══ HELPERS ═══
  getExplorerUrl(txHash) {
    return `${PUSHCHAIN_EXPLORER}/tx/${txHash}`;
  }
  getAddressUrl(address) {
    return `${PUSHCHAIN_EXPLORER}/address/${address}`;
  }
};
var MoleSwapError = class extends Error {
  constructor(message, status) {
    super(message);
    this.name = "MoleSwapError";
    this.status = status;
  }
};
var index_default = MoleSwap;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONTRACTS,
  MoleSwap,
  MoleSwapError,
  PUSHCHAIN_CHAIN_ID,
  PUSHCHAIN_EXPLORER,
  PUSHCHAIN_RPC
});
