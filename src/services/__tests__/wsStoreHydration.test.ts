import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("empty node store hydration", () => {
  it.each([{payload: []}, {payload: {nodes: []}}, {payload: {data: []}}])("finishes loading for an explicit empty list: $payload", async ({payload}) => {
    vi.resetModules();
    const fetchMock = vi.fn().mockResolvedValue({ok: true, json: async () => payload});
    vi.stubGlobal("fetch", fetchMock);
    const store = await import("@/services/wsStore");
    const release = store.retainStore();
    try {
      await vi.waitFor(() => expect(store.getStoreStatusSnapshot().hydrated).toBe(true));
      expect(store.getHomeNodeSummariesSnapshot()).toEqual([]);
      expect(store.getStoreStatusSnapshot().nodeInfoError).toBe(false);
    } finally { release(); }
  });
  it("does not treat a malformed response as a successfully loaded empty site", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: true, json: async () => ({error: "unavailable"})}));
    const store = await import("@/services/wsStore");
    const release = store.retainStore();
    try {
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(store.getStoreStatusSnapshot().hydrated).toBe(false);
    } finally { release(); }
  });
});
