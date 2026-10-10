import { describe, expect, test } from "bun:test";
import { resolveBmTier, inheritedTierPatch, shouldPropagateBmTier } from "../src/lib/metaBmTier";

describe("BM tier inheritance", () => {
  const bm = { id: "a" };
  const peer = { id: "old", meta_bm_id: "a", ativo: true, messaging_limit_manual: "TIER_2K" };
  test("inherits 2000 from another instance", () => {
    expect(resolveBmTier(bm, [peer])).toEqual({ value: "TIER_2K", limit: 2000, source: "manual", unlimited: false });
    expect(inheritedTierPatch(resolveBmTier(bm, [peer])).tier_diario).toBe(2000);
  });
  test("explicit BM tier wins over instance tier", () => {
    expect(resolveBmTier({ ...bm, tier_manual: true, tier_diario: 10000 }, [peer])?.limit).toBe(10000);
  });
  test("preserves unlimited", () => {
    expect(resolveBmTier({ ...bm, tier_ilimitado: true }, [peer])?.unlimited).toBe(true);
  });
  test("preserves custom BM limit without rounding", () => {
    const result = resolveBmTier({ ...bm, tier_manual: true, tier_diario: 3500 }, [peer]);
    expect(inheritedTierPatch(result)).toEqual({ messaging_limit_manual: null, messaging_limit_source: "bm", tier_diario: 3500 });
  });
  test("uses shared effective quota rather than first peer", () => {
    expect(resolveBmTier(bm, [peer], { tier_diario: 10000, tier_ilimitado: false, instancias: 2 })?.limit).toBe(10000);
  });
  test("does not freeze Meta tier as manual", () => {
    const result = resolveBmTier(bm, [{ ...peer, messaging_limit_manual: null, saude_tier: "MESSAGING_LIMIT_TIER_2K" }]);
    expect(result?.limit).toBe(2000);
    expect(inheritedTierPatch(result).messaging_limit_manual).toBeNull();
    expect(result?.source).toBe("meta_api");
  });
  test("switching BMs does not retain previous tier", () => {
    expect(resolveBmTier({ id: "b" }, [peer])).toBeNull();
    expect(inheritedTierPatch(resolveBmTier({ id: "b" }, [peer])).messaging_limit_manual).toBeNull();
  });
  test("unknown or absent BM retains automatic fallback", () => {
    expect(resolveBmTier(undefined, [peer])).toBeNull();
    expect(inheritedTierPatch(null).messaging_limit_manual).toBeNull();
  });
  test("ignores inactive and excludes current instance from peers", () => {
    expect(resolveBmTier(bm, [{ ...peer, ativo: false }])).toBeNull();
    expect(resolveBmTier(bm, [peer], null, "old")).toBeNull();
  });
  test("inheritance cannot propagate; explicit changes can", () => {
    expect(shouldPropagateBmTier(false, "TIER_2K", "TIER_250")).toBe(false);
    expect(shouldPropagateBmTier(true, "TIER_2K", "TIER_250")).toBe(true);
    expect(shouldPropagateBmTier(true, "TIER_2K", "TIER_2K")).toBe(false);
  });
});