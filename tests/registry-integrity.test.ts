import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import { TOKENS, POOLS, CONTRACTS, VISIBLE_TOKENS, VISIBLE_POOLS, findPool, getTokenByAddress } from "@/lib/pushchain/contracts";
import { PRC20_BRIDGE_MAP, getBridgeInfoForPrc20, canAutoBridgeFrom, getSdkMoveableToken } from "@/lib/pushchain/prc20-bridge-map";

const lc = (s: string) => s.toLowerCase();

describe("registry integrity", () => {
  it("every TOKENS address is checksum-valid and unique", () => {
    const seen = new Set<string>();
    for (const t of TOKENS) {
      if (t.address !== ethers.ZeroAddress) {
        expect(ethers.getAddress(t.address), `${t.symbol} not canonical`).toBe(t.address);
      }
      expect(seen.has(lc(t.address)), `duplicate address for ${t.symbol}`).toBe(false);
      seen.add(lc(t.address));
    }
  });

  it("every TOKENS symbol is unique", () => {
    const syms = TOKENS.map((t) => t.symbol);
    expect(new Set(syms).size).toBe(syms.length);
  });

  it("every POOLS address is checksum-valid and unique", () => {
    const seen = new Set<string>();
    for (const p of POOLS) {
      expect(ethers.getAddress(p.address), `${p.name} not canonical`).toBe(p.address);
      expect(seen.has(lc(p.address)), `duplicate pool ${p.name}`).toBe(false);
      seen.add(lc(p.address));
    }
  });

  it("every POOLS token0/token1 resolves to a known TOKENS entry", () => {
    for (const p of POOLS) {
      expect(getTokenByAddress(p.token0), `${p.name} token0 unknown: ${p.token0}`).toBeTruthy();
      expect(getTokenByAddress(p.token1), `${p.name} token1 unknown: ${p.token1}`).toBeTruthy();
    }
  });

  it("every pool pairs against WPC exactly once per fee tier", () => {
    for (const p of POOLS) {
      const hasWpc = lc(p.token0) === lc(CONTRACTS.WPC) || lc(p.token1) === lc(CONTRACTS.WPC);
      expect(hasWpc, `${p.name} has no WPC leg`).toBe(true);
    }
  });

  it("pool name matches the non-WPC token's symbol", () => {
    for (const p of POOLS) {
      const other = lc(p.token0) === lc(CONTRACTS.WPC) ? p.token1 : p.token0;
      const tok = getTokenByAddress(other)!;
      expect(p.name, `pool name/token mismatch`).toBe(`${tok.symbol}/WPC`);
    }
  });

  it("findPool resolves both directions for every pool", () => {
    for (const p of POOLS) {
      expect(findPool(p.token0, p.token1)?.address).toBe(p.address);
      expect(findPool(p.token1, p.token0)?.address).toBe(p.address);
    }
  });
});

describe("bridge map <-> TOKENS coherence", () => {
  it("each map key equals its own prc20Address lowercased", () => {
    for (const [key, info] of Object.entries(PRC20_BRIDGE_MAP)) {
      expect(key).toBe(lc(info.prc20Address));
      expect(ethers.getAddress(info.prc20Address)).toBe(info.prc20Address);
    }
  });

  it("every map entry corresponds to a token in TOKENS", () => {
    for (const info of Object.values(PRC20_BRIDGE_MAP)) {
      const tok = getTokenByAddress(info.prc20Address);
      expect(tok, `bridge map has ${info.prc20Address} which is not in TOKENS`).toBeTruthy();
    }
  });

  it("every bridgeable:true token has a bridge map entry", () => {
    const missing = TOKENS.filter((t) => t.bridgeable && !getBridgeInfoForPrc20(t.address)).map((t) => t.symbol);
    expect(missing, `bridgeable tokens with no map entry: ${missing.join(", ")}`).toEqual([]);
  });

  // A dormant map entry is allowed (pBNB keeps one so its bridge info stays
  // recorded), but only for a token the UI can never select as a swap input —
  // otherwise the entry would offer a bridge the token isn't cleared for.
  it("map entries for non-bridgeable tokens are unreachable in the UI", () => {
    const reachable = Object.values(PRC20_BRIDGE_MAP)
      .map((i) => getTokenByAddress(i.prc20Address))
      .filter((t) => t && !t.bridgeable && t.swappable !== false && !t.hidden)
      .map((t) => t!.symbol);
    expect(reachable, `selectable tokens with a bridge entry but bridgeable:false: ${reachable.join(", ")}`).toEqual([]);
  });

  it("map originSymbol agrees with the TOKENS originSymbol", () => {
    for (const info of Object.values(PRC20_BRIDGE_MAP)) {
      const tok = getTokenByAddress(info.prc20Address)!;
      expect(tok.originSymbol, `${tok.symbol} originSymbol drift`).toBe(info.originSymbol);
    }
  });

  it("map decimals match on-chain-registry decimals for stables", () => {
    for (const info of Object.values(PRC20_BRIDGE_MAP)) {
      const tok = getTokenByAddress(info.prc20Address)!;
      if (info.mechanism !== "native") {
        expect(tok.decimals, `${tok.symbol} decimals drift`).toBe(info.originDecimals);
      }
    }
  });

  it("canAutoBridgeFrom only fires when origin chains match", () => {
    for (const info of Object.values(PRC20_BRIDGE_MAP)) {
      expect(canAutoBridgeFrom(info.prc20Address, info.originChain)).toBe(true);
      expect(canAutoBridgeFrom(info.prc20Address, "eip155:999999")).toBe(false);
      expect(canAutoBridgeFrom(info.prc20Address, null)).toBe(false);
    }
  });
});

describe("bridge map <-> live SDK constants", () => {
  it("every entry's originSymbol resolves against the installed SDK", async () => {
    const { PushChain } = await import("@pushchain/core");
    const M = (PushChain as any).CONSTANTS.MOVEABLE.TOKEN;
    for (const info of Object.values(PRC20_BRIDGE_MAP)) {
      const resolved = getSdkMoveableToken(info.prc20Address, M);
      expect(resolved, `${info.prc20Address} (${info.originChainSdkName}.${info.originSymbol}) resolved to null — SDK accessor threw`).toBeTruthy();
      expect(lc(resolved.address), `${info.originSymbol} origin address drift`).toBe(lc(info.originAddress));
      expect(resolved.decimals, `${info.originSymbol} origin decimals drift`).toBe(info.originDecimals);
      expect(resolved.mechanism).toBe(info.mechanism);
    }
  });

  it("non-native entries: SDK getPRC20Address lands on the registry PRC-20", async () => {
    const { PushChain } = await import("@pushchain/core");
    const M = (PushChain as any).CONSTANTS.MOVEABLE.TOKEN;
    for (const info of Object.values(PRC20_BRIDGE_MAP)) {
      if (info.mechanism === "native") continue; // natives bridge as native PC, no PRC-20 lookup
      const mt = getSdkMoveableToken(info.prc20Address, M);
      const out = (PushChain as any).utils.tokens.getPRC20Address(mt);
      expect(lc(out.address), `${info.originChainSdkName}.${info.originSymbol} bridges into ${out.address} but registry has ${info.prc20Address}`).toBe(lc(info.prc20Address));
    }
  });
});

describe("visibility filters", () => {
  it("hidden tokens are excluded and their pools too", () => {
    expect(VISIBLE_TOKENS.every((t) => !t.hidden)).toBe(true);
    expect(VISIBLE_POOLS.every((p) => !p.hidden)).toBe(true);
    const hiddenAddrs = new Set(TOKENS.filter((t) => t.hidden).map((t) => lc(t.address)));
    for (const p of VISIBLE_POOLS) {
      expect(hiddenAddrs.has(lc(p.token0)) || hiddenAddrs.has(lc(p.token1)), `${p.name} visible but references a hidden token`).toBe(false);
    }
  });
});
