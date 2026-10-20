import { ArrowDown, ArrowUp, CircleDollarSign, Database, HardDrive, MemoryStick, Server, Wifi } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { NodeWorldMap } from "@/components/node/NodeWorldMap";
import { usePriceVisibility } from "@/hooks/usePriceVisibility";
import type { HomeNodeSummary } from "@/services/wsStore";
import { formatBytes } from "@/utils/format";

interface Props {
  nodes: HomeNodeSummary[];
  nameByUuid: Map<string, string>;
  overview: {
    totalRamUsed: number; totalRamTotal: number;
    totalDiskUsed: number; totalDiskTotal: number;
    trafficUp: number; trafficDown: number; netUp: number; netDown: number;
  };
  costSummary: { remainingCny: number } | null;
  costLoading: boolean;
  showAssetLink: boolean;
  showTrafficLink: boolean;
  offlineOnly: boolean;
  onToggleOffline: () => void;
}

function BytesValue({ value, rate = false }: { value: number; rate?: boolean }) {
  const [amount, unit] = formatBytes(value).split(" ");
  return <><strong>{amount}</strong><span className="map-stat-unit">{unit}{rate ? "/s" : ""}</span></>;
}

function CapacityValue({ used, total }: { used: number; total: number }) {
  const [usedAmount, usedUnit] = formatBytes(used).split(" ");
  const [totalAmount, totalUnit] = formatBytes(total).split(" ");
  const label = "已用 " + formatBytes(used) + "，总计 " + formatBytes(total);
  return <div className="map-stat-capacity" role="group" title={label} aria-label={label}>
    <strong>{Number(usedAmount)}</strong>{usedUnit !== totalUnit && <span className="capacity-unit">{usedUnit}</span>}
    <span className="capacity-divider" aria-hidden="true">/</span><span className="capacity-total">{Number(totalAmount)}</span><span className="capacity-unit">{totalUnit}</span>
  </div>;
}

export function MapOverview({ nodes, nameByUuid, overview, costSummary, costLoading, showAssetLink, showTrafficLink, offlineOnly, onToggleOffline }: Props) {
  const { isPriceVisible } = usePriceVisibility();
  const online = nodes.filter(node => node.online === true).length;
  const offline = nodes.filter(node => node.online === false).length;
  const rateScale = Math.pow(10, Math.ceil(Math.log10(Math.max(1024, overview.netUp, overview.netDown))));
  const assetValue: ReactNode = !isPriceVisible ? "保密" : costSummary
    ? "¥" + costSummary.remainingCny.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : costLoading || nodes.length > 0 ? "—" : "¥0.00";
  return (
    <section className="map-overview" aria-label="点阵地图与监控状态">
      <NodeWorldMap nodes={nodes} nameByUuid={nameByUuid} />
      <div className="map-overview-stats" aria-label="服务器监控状态">
        <div className="map-stat-card" data-metric="ram">
          <div className="map-stat-head"><span>内存用量</span><MemoryStick size={16} aria-hidden="true" /></div>
          <CapacityValue used={overview.totalRamUsed} total={overview.totalRamTotal} />
        </div>
        <div className="map-stat-card" data-metric="asset">
          <div className="map-stat-head"><span>剩余价值</span><CircleDollarSign size={16} aria-hidden="true" /></div>
          <div className="map-stat-value map-stat-money">{showAssetLink && isPriceVisible
            ? <Link to="/assets" aria-label="打开资产统计页">{assetValue}</Link>
            : <strong>{assetValue}</strong>}</div>
        </div>
        <div className="map-stat-card map-stat-network" data-metric="network">
          <div className="map-stat-head"><span>实时网速</span><Wifi size={16} aria-hidden="true" /></div>
          <div className="network-speed-rows">
            <SpeedRow direction="upload" value={overview.netUp} scale={rateScale} />
            <SpeedRow direction="download" value={overview.netDown} scale={rateScale} />
          </div>
        </div>
        <div className="map-stat-card" data-metric="disk">
          <div className="map-stat-head"><span>硬盘用量</span><HardDrive size={16} aria-hidden="true" /></div>
          <CapacityValue used={overview.totalDiskUsed} total={overview.totalDiskTotal} />
        </div>
        <div className="map-stat-card" data-metric="traffic">
          <div className="map-stat-head"><span>累计流量</span><Database size={16} aria-hidden="true" /></div>
          <div className="map-stat-value">{showTrafficLink
            ? <Link to="/traffic" aria-label="打开流量统计页"><BytesValue value={overview.trafficUp + overview.trafficDown} /></Link>
            : <BytesValue value={overview.trafficUp + overview.trafficDown} />}</div>
        </div>
        <button type="button" className="map-stat-card map-stat-nodes" data-metric="nodes" aria-pressed={offlineOnly} aria-label={"节点情况，在线 " + online + "，总数 " + nodes.length + "，离线 " + offline + "。" + (offlineOnly ? "点击返回全部节点" : "点击查看离线节点")} onClick={onToggleOffline}>
          <span className="map-stat-head"><span>节点情况</span><Server size={16} aria-hidden="true" /></span>
          <span className="map-stat-value node-count-value"><strong className="node-count-online">{online}</strong><span className="node-count-divider">/</span><strong className="node-count-total">{nodes.length}</strong></span>
          <span className="node-count-track" aria-hidden="true"><span style={{ width: (nodes.length ? online / nodes.length * 100 : 0) + "%" }} /></span>
        </button>
      </div>
    </section>
  );
}

function SpeedRow({ direction, value, scale }: { direction: "upload" | "download"; value: number; scale: number }) {
  const Icon = direction === "upload" ? ArrowUp : ArrowDown;
  const label = direction === "upload" ? "上行" : "下行";
  return <div className="network-speed-row" role="group" aria-label={label + "网速"} data-direction={direction} data-moving={value > 0}>
    <div className="network-speed-value"><span className="network-speed-label"><Icon size={12} aria-hidden="true" /><span>{label}</span></span><span className="network-speed-number"><BytesValue value={value} rate /></span></div>
    <div className="network-speed-track" aria-hidden="true"><span className="network-speed-fill" style={{ width: Math.min(100, value / scale * 100) + "%" }} /></div>
  </div>;
}
