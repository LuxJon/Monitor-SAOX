import { describe, expect, it, vi } from "vitest";
import { buildPingOverviewMap } from "@/hooks/usePingOverview";
import { selectHomepageCarrierLines } from "@/utils/pingTasks";
import { buildCardTags } from "@/utils/cardTags";
import { pingEmptyLabels } from "@/components/node/nodeCardShared";
import type { PingRecordsResponse } from "@/types/komari";

const task = (id: number, name: string, clients = ["n1"]) => ({ id, name, clients, interval: 60, loss: 0, type: "icmp", target: "", weight: id });
const reply = (): PingRecordsResponse => ({ records: [
  { task_id: 8, client: "n1", time: Date.now(), value: 43, loss: 0 },
  { task_id: 12, client: "n1", time: Date.now(), value: 86, loss: 0 },
  { task_id: 19, client: "n1", time: Date.now(), value: 118, loss: 0 },
], tasks: [task(19, "广州移动"), task(8, "上海电信"), task(12, "北京联通")], intervalByClient: { n1: 300 } });

describe("SAO homepage regression", () => {
  it("discovers real task IDs without homepage bindings and propagates the hub bucket width", async () => {
    const progress = vi.fn();
    const result = await buildPingOverviewMap(1, ["n1"], {}, [], undefined, undefined, vi.fn().mockResolvedValue(reply()), undefined, progress);
    expect(progress.mock.calls[0]![0].singleItems.get("n1").loadState).toBe("pending");
    expect(result.multiLines.get("n1")?.map(line => line.taskId)).toEqual([8, 12, 19]);
    expect(result.singleItems.get("n1")?.metricIntervalMs).toBe(300000);
    expect(result.singleItems.get("n1")?.isAssigned).toBe(true);
  });
  it("distinguishes configured probes without samples from an actually unconfigured node", async () => {
    const result = await buildPingOverviewMap(1, ["n1", "n2"], {}, [], undefined, undefined,
      vi.fn().mockResolvedValue({ records: [], tasks: [task(8, "电信")] }));
    expect(result.multiLines.get("n1")?.[0]).toMatchObject({ taskName: "电信", loadState: "ready", lastValue: null, isAssigned: true });
    expect(result.singleItems.get("n2")).toMatchObject({ isAssigned: false, loadState: "ready" });
  });
  it("keeps successful data on a failed refresh and labels first-load failures correctly", async () => {
    const previous = await buildPingOverviewMap(1, ["n1"], {}, [], undefined, undefined, vi.fn().mockResolvedValue(reply()));
    const failed = await buildPingOverviewMap(1, ["n1"], {}, [], undefined, previous, vi.fn().mockRejectedValue(new Error("offline")));
    expect(failed.multiLines.get("n1")?.[0]).toMatchObject({ loadState: "error", lastValue: 43 });
    expect(failed.successfulTaskIds).toEqual([]);
    expect(pingEmptyLabels(false, false, true).text).toBe("加载失败");
    expect(pingEmptyLabels(false, true, false).text).toBe("加载中");
  });
  it("keeps partial node failures separate from healthy nodes and recovers on retry", async () => {
    const response = { ...reply(), failedClients: ["n2"] };
    const result = await buildPingOverviewMap(1, ["n1", "n2"], {}, [], undefined, undefined, vi.fn().mockResolvedValue(response));
    expect(result.singleItems.get("n1")?.loadState).toBe("ready");
    expect(result.singleItems.get("n2")?.loadState).toBe("error");
    const retry = await buildPingOverviewMap(1, ["n1", "n2"], {}, [], undefined, result,
      vi.fn().mockResolvedValue({ records: [], tasks: [task(9, "移动", ["n2"])] }));
    expect(retry.singleItems.get("n2")).toMatchObject({ isAssigned: true, loadState: "ready" });
  });
  it("preserves per-node failures with manually selected lines", async () => {
    const result = await buildPingOverviewMap(1, ["n1", "n2"], {}, [8], undefined, undefined,
      vi.fn().mockResolvedValue({ ...reply(), failedClients: ["n2"] }));
    expect(result.multiLines.get("n2")?.[0].loadState).toBe("error");
    expect(result.multiLines.get("n1")?.[0].lastValue).toBe(43);
  });
  it("discovers unbound servers even when another server has a legacy single-task binding", async () => {
    const load = vi.fn().mockResolvedValue({ ...reply(), records: [...reply().records, { task_id: 19, client: "n2", time: Date.now(), value: 120 }],
      tasks: [task(8, "电信"), task(19, "移动", ["n2"])] });
    const result = await buildPingOverviewMap(1, ["n1", "n2"], { "8": ["n1"] }, [], undefined, undefined, load);
    expect(result.singleItems.get("n1")?.lastValue).toBe(43);
    expect(result.multiLines.get("n2")?.[0]).toMatchObject({ taskId: 19, loadState: "ready", lastValue: 120 });
  });
  it("selects one line for each carrier even when IDs and backend ordering differ", () => {
    const lines = [ { taskId: 1, taskName: "电信备用" }, { taskId: 2, taskName: "电信主线" },
      { taskId: 15, taskName: "CMCC 广州" }, { taskId: 27, taskName: "CUCC 北京" }, { taskId: 31, taskName: "DNS" } ];
    expect(selectHomepageCarrierLines(lines).map(line => line.taskId)).toEqual([1, 27, 15]);
    expect(selectHomepageCarrierLines([{ taskId: 19, taskName: "東京 A" }, { taskId: 8, taskName: "大阪 B" }]).map(line => line.taskId)).toEqual([8, 19]);
  });
  it("splits full-width and ASCII delimiters into distinct colored notes without duplicates", () => {
    const tags = buildCardTags("80Mbps;三网CN2；不限流量", "不限流量;晚高峰三网直连<teal>");
    expect(tags.map(tag => tag.label)).toEqual(["80Mbps", "三网CN2", "不限流量", "晚高峰三网直连"]);
    expect(new Set(tags.map(tag => tag.color)).size).toBe(3);
    expect(tags[3]?.color).toBe("teal");
  });
});
