import { readFileSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import { normalizeThemeSettings, THEME_CONFIG_KEYS } from "@/utils/themeSettings";
import { THEME_SHORT, clearServerThemeSettingsCache, fetchServerThemeConfig, saveThemeSettings } from "@/services/api";
import { getLocalThemeSettings, replaceLocalThemeSettings } from "@/services/themeSettingsStore";
const manifest = JSON.parse(readFileSync(new URL("../../../theme.json", import.meta.url), "utf8"));
afterEach(() => { vi.unstubAllGlobals(); clearServerThemeSettingsCache(); replaceLocalThemeSettings({}); });
describe("SAOX release and coexistence", () => {
  it("uses an independent install identity and synchronized version", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
    expect(manifest.short).toBe("saox"); expect(THEME_SHORT).toBe("saox");
    expect(manifest.name).toBe("SAOX"); expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/); expect(pkg.version).toBe(manifest.version);
  });
  it("keeps backend schema and normalized defaults in sync, with no removed visitor controls", () => {
    const items = manifest.config.filter((item: {key?: string}) => item.key);
    expect(items.map((item: {key: string}) => item.key).sort()).toEqual([...THEME_CONFIG_KEYS].sort());
    const defaults = normalizeThemeSettings({}) as unknown as Record<string, unknown>;
    for (const item of items) expect(defaults[item.key], item.key).toEqual(item.default);
    expect(items.some((item: {key: string}) => item.key === "enableHomeSort")).toBe(false);
    expect(items.find((item: {key: string}) => item.key === "mobileNodeViewMode").options.map((o: {value: string}) => o.value)).not.toContain("list");
  });
  it("never loads original SAO configuration when SAOX is unconfigured", async () => {
    const requests: string[] = [];
    vi.stubGlobal("window", {localStorage: {getItem: () => null, setItem: () => {}, removeItem: () => {}}});
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { requests.push(url); return new Response("not found", {status:404}); }));
    await fetchServerThemeConfig();
    expect(requests).toContain("/api/themes/saox/config");
    expect(requests.every(url => !url.includes("/sao/") && !url.includes("sao-config"))).toBe(true);
  });
  it("does not read or overwrite original SAO browser settings", async () => {
    const storage = new Map([["monitor-sao:theme-settings", JSON.stringify({defaultAppearance:"light"})], ["appearance", '"light"']]);
    vi.stubGlobal("window", {localStorage: {getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string,v: string) => storage.set(k,v), removeItem: (k: string) => storage.delete(k)}});
    replaceLocalThemeSettings({defaultAppearance:"dark"});
    expect(JSON.parse(storage.get("monitor-sao:theme-settings")!)).toEqual({defaultAppearance:"light"});
    expect(storage.get("appearance")).toBe('"light"');
    expect(JSON.parse(storage.get("saox:theme-settings")!)).toEqual({defaultAppearance:"dark"});
  });
  it.each([401,403,500])("rejects a failed save (%s) without marking the snapshot as saved", async status => {
    vi.stubGlobal("window", {localStorage: {getItem: () => null,setItem: () => {},removeItem: () => {}}});
    replaceLocalThemeSettings({defaultAppearance:"light"});
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method === "PUT" ? new Response("rejected", {status}) : Response.json({defaultAppearance:"light"})));
    await expect(saveThemeSettings({defaultAppearance:"dark"})).rejects.toMatchObject({status,endpoint:"/api/themes/saox/config"});
    expect(getLocalThemeSettings().defaultAppearance).toBe("light");
  });
});
