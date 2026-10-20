import { describe, expect, it } from "vitest";
import type { HomeNodeSummary } from "@/services/wsStore";
import { buildNodeMap } from "@/utils/nodeWorldMap";
import { LAND_POSITIONS, placeOf } from "@/utils/worldMapProjection";
const node = (uuid: string, region: string, online: boolean | null) => ({ uuid, region, online } as HomeNodeSummary);
describe("server world map", () => {
  it("groups country codes, flags and aliases and resolves actual names", () => {
    const data = buildNodeMap([node("a", "US", true), node("b", "🇺🇸", false), node("c", "Hong Kong", true)], new Map([["a", "US Primary"]]));
    expect(data.total).toBe(3);
    expect(data.online).toBe(2);
    expect(data.offline).toBe(1);
    expect(data.places.map(p => p.code)).toEqual(["HK", "US"]);
    expect(data.places[1].tone).toBe("some");
    expect(data.places[1].nodes.map(n => n.name)).toEqual(["US Primary", "b"]);
    expect(data.places[0].tone).toBe("all");
  });
  it("distinguishes offline, mixed and unconfirmed states", () => {
    const data = buildNodeMap([node("a", "DE", false), node("b", "JP", null), node("c", "JP", true)]);
    expect(data.places[0].tone).toBe("none");
    expect(data.places[1].tone).toBe("unknown");
    expect(data.pending).toBe(1);
    expect(data.offline).toBe(1);
    expect(data.online).toBe(1);
  });
  it("includes unlocated servers in totals without guessing coordinates", () => {
    const data = buildNodeMap([node("a", "", true), node("b", "Unknown Region", false), node("c", "ZZ", null)]);
    expect(data).toMatchObject({total: 3, online: 1, offline: 1, pending: 1, unmapped: 3, places: []});
  });
  it("has no fabricated locations or totals for an empty list", () => {
    expect(buildNodeMap([])).toEqual({total: 0, online: 0, offline: 0, pending: 0, unmapped: 0, places: []});
  });
  it("recomputes regions, names and status after realtime changes or removals", () => {
    const first = buildNodeMap([node("a", "US", true), node("b", "DE", false)]);
    const next = buildNodeMap([node("a", "JP", false)], new Map([["a", "Tokyo New"]]));
    expect(first.places).toHaveLength(2);
    expect(next).toMatchObject({total: 1, online: 0, offline: 1});
    expect(next.places[0]).toMatchObject({code: "JP", tone: "none", nodes: [{uuid: "a", name: "Tokyo New", online: false}]});
  });
  it("keeps source geography within the map viewport", () => {
    expect(LAND_POSITIONS.length).toBeGreaterThan(1000);
    expect(LAND_POSITIONS.every(([x,y]) => x >= 0 && x <= 360 && y >= 0 && y <= 144)).toBe(true);
    expect(placeOf("JP")).not.toBeNull();
    expect(placeOf("ZZ")).toBeNull();
  });
});
