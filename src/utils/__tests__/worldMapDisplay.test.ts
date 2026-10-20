import { describe, expect, it } from "vitest";
import { WORLD_COUNTRIES } from "@/data/world-countries";
import { MAP_H } from "../worldMapProjection";
import { MOBILE_MAP_HEIGHT, mobileMapY, mobileCountryPath, mapDisplayHeight } from "../worldMapDisplay";

describe("phone map display", () => {
  it("keeps desktop geography unchanged and includes the entire phone latitude extent", () => {
    expect(mapDisplayHeight(false)).toBe(MAP_H);
    expect(MOBILE_MAP_HEIGHT).toBeGreaterThan(240);
    expect(MOBILE_MAP_HEIGHT).toBeLessThan(250);
    expect(mobileMapY(0)).toBeCloseTo(0);
    expect(mobileMapY(MAP_H)).toBeCloseTo(MOBILE_MAP_HEIGHT);
    expect(mobileMapY(-100)).toBe(0);
    expect(mobileMapY(500)).toBe(MOBILE_MAP_HEIGHT);
  });
  it("keeps latitude order and gives northern regions more visible vertical detail", () => {
    const equator = mobileMapY(84);
    expect(equator).toBeGreaterThan(MOBILE_MAP_HEIGHT / 2);
    expect(mobileMapY(44) - mobileMapY(34)).toBeGreaterThan(mobileMapY(84) - mobileMapY(74));
    for (let y = 1; y <= 144; y++) expect(mobileMapY(y)).toBeGreaterThan(mobileMapY(y - 1));
  });
  it("preserves country islands and holes with every vertex inside the phone map", () => {
    for (const country of WORLD_COUNTRIES) {
      const d = mobileCountryPath(country.d);
      expect(d.match(/[A-Za-z]/g)).toEqual(country.d.match(/[A-Za-z]/g));
      expect(d).not.toMatch(/NaN|Infinity/);
      const numbers = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      for (let i = 0; i < numbers.length; i += 2) {
        expect(numbers[i]).toBeGreaterThanOrEqual(0);
        expect(numbers[i]).toBeLessThanOrEqual(360);
        expect(numbers[i + 1]).toBeGreaterThanOrEqual(0);
        expect(numbers[i + 1]).toBeLessThanOrEqual(MOBILE_MAP_HEIGHT + .001);
      }
    }
  });
});
