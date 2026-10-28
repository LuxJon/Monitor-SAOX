import { describe, expect, it } from "vitest";
import { getExpiringNodes, parseExpiryWarningDays } from "../expiryFilter";

describe("backend expiry reminder window", () => {
  it.each([0, 7, 30, 365, "7", "0"])("accepts backend value %s", value => {
    expect(parseExpiryWarningDays(value)).toBe(Number(value));
  });
  it.each([undefined, null, "", " ", true, -1, 366, 7.5, "invalid"])("rejects unavailable/invalid value %s", value => {
    expect(parseExpiryWarningDays(value)).toBeNull();
  });
  const nodes = [-1, 0, 7, 8, 30, null].map((days, index) => ({ uuid: String(index), expired_at: "2099-01-01", expires_in: days }));
  it("matches Monitor's inclusive 0..days window using backend calendar days", () => {
    expect(getExpiringNodes(nodes, 7).map(n => n.expires_in)).toEqual([0, 7]);
    expect(getExpiringNodes(nodes, 30).map(n => n.expires_in)).toEqual([0, 7, 8, 30]);
  });
  it("does not guess a threshold when disabled or unavailable", () => {
    expect(getExpiringNodes(nodes, 0)).toEqual([]);
    expect(getExpiringNodes(nodes, null)).toEqual([]);
  });
  it("drops renewed nodes and accepts expiry fallback for older backend versions", () => {
    const now = Date.parse("2026-10-28T00:00:00Z");
    expect(getExpiringNodes([{ uuid: "a", expired_at: "2026-10-30" }], 7, now)).toHaveLength(1);
    expect(getExpiringNodes([{ ...nodes[1], expires_in: 60 }], 7)).toEqual([]);
  });
});
