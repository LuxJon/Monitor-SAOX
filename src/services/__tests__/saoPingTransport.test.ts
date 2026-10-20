import { afterEach, describe, expect, it, vi } from "vitest";
import { getPingOverview } from "@/services/api";
const data = (id: number) => ({ step: 300, ping: [{ task_id: id, ts: Date.now()/1000, latency: null, loss: 100 }], probes: { [id]: "电信" }, loss: { [id]: 11.7 } });
function response(body: unknown) { return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }); }
afterEach(() => vi.unstubAllGlobals());
describe("SAO Ping transport", () => {
  it("shares a node response across three tasks, preserves loss totals and never converts timeouts to zero", async () => {
    const fetcher = vi.fn(async () => response(data(101)));
    vi.stubGlobal("fetch", fetcher);
    const results = await Promise.all([101, 102, 103].map(id => getPingOverview(1, id, { entityIds: ["shared-ping-node"] })));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(results[0]?.records[0]?.value).toBe(-1);
    expect(results[0]?.stats?.[0]?.loss).toBe(11.7);
    expect(results[0]?.intervalByClient?.["shared-ping-node"]).toBe(300);
  });
  it("reports a node error while keeping other nodes and retries a transient failure", async () => {
    let failed = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("retry-node") && failed) return new Response("down", { status: 502 });
      return response(data(104));
    }));
    const result = await getPingOverview(1, undefined, { entityIds: ["good-node", "retry-node"] });
    expect(result.failedClients).toEqual(["retry-node"]);
    expect(result.records[0]?.client).toBe("good-node");
    failed = false;
    const retry = await getPingOverview(1, undefined, { entityIds: ["retry-node"] });
    expect(retry.failedClients).toEqual([]);
    expect(retry.records[0]?.client).toBe("retry-node");
  });
  it("rejects all-failed history instead of returning a successful empty result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    await expect(getPingOverview(1, undefined, { entityIds: ["failed-node"] })).rejects.toThrow();
  });
  it("bounds concurrent node history requests", async () => {
    let active = 0, peak = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      peak = Math.max(peak, ++active);
      await new Promise(resolve => setTimeout(resolve, 2));
      active--;
      return response(data(105));
    }));
    await getPingOverview(1, undefined, { entityIds: Array.from({ length: 18 }, (_, i) => "bounded-" + i) });
    expect(peak).toBeLessThanOrEqual(4);
  });
});
