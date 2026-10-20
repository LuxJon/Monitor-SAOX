// Dot geometry adapted from bluesmkun/openlat (MIT).
// Full license: public/licenses/openlat-LICENSE.txt.
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import type { HomeNodeSummary } from "@/services/wsStore";
import { Flag } from "@/components/ui/Flag";
import { buildNodeMap } from "@/utils/nodeWorldMap";
import { WORLD_COUNTRIES } from "@/data/world-countries";
import { useMapViewport } from "@/hooks/useMapViewport";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { mapDisplayHeight, mobileCountryPath, mobileMapY } from "@/utils/worldMapDisplay";

let phoneCountries: ReadonlyArray<{ id: string; name: string; d: string }> | undefined;
function displayCountries(mobile: boolean) {
  if (!mobile) return WORLD_COUNTRIES;
  return phoneCountries ??= WORLD_COUNTRIES.map(country => ({ ...country, d: mobileCountryPath(country.d) }));
}
const Land = memo(function Land({ mobile }: { mobile: boolean }) {
  const pattern = useId().replaceAll(":", "");
  return <g className="world-map-land" transform={mobile ? undefined : "scale(.36 .3598971722)"}>
    <defs><pattern id={pattern} width={mobile ? 2.592 : 7.2} height={mobile ? 2.592 : 7.2} patternUnits="userSpaceOnUse"><circle cx={mobile ? 1.296 : 3.6} cy={mobile ? 1.296 : 3.6} r={mobile ? .972 : 2.7} fill="currentColor" /></pattern></defs>
    {displayCountries(mobile).map(country => <path key={country.id} data-country={country.id} className="world-map-country" d={country.d} fill={"url(#" + pattern + ")"} fillRule="evenodd"><title>{country.name}</title></path>)}
  </g>;
});
interface Props { nodes: HomeNodeSummary[]; nameByUuid?: Map<string, string> }

function NodeWorldMapBase({ nodes, nameByUuid }: Props) {
  const data = useMemo(() => buildNodeMap(nodes, nameByUuid), [nodes, nameByUuid]);
  const [selected, setSelected] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const mobile = useMediaQuery("(max-width: 600px)");
  const mapHeight = mapDisplayHeight(mobile);
  const viewport = useMapViewport(mapHeight);
  const places = useMemo(() => mobile ? data.places.map(place => ({ ...place, y: mobileMapY(place.y) })) : data.places, [data.places, mobile]);
  const instructions = useId();
  const lastMarkerTouch = useRef(-Infinity);
  const trigger = useRef<SVGGElement | null>(null);
  const active = data.places.find(place => place.code === selected) ?? null;
  const restoreFocus = () => { if (trigger.current?.isConnected) trigger.current.focus(); };
  useEffect(() => {
    if (!active) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && root.current?.contains(target) && target.closest("[data-map-place], [data-map-panel]")) return;
      setSelected(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSelected(null); restoreFocus(); }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [active]);
  return (
    <section ref={root} className="node-world-map" style={{ aspectRatio: 360 / mapHeight }} data-projection={mobile ? "mobile" : "wide"} aria-label="服务器节点分布" data-map-total={data.total} data-map-regions={data.places.length} data-map-unmapped={data.unmapped}>
      <span id={instructions} className="sr-only">拖拽移动地图，双指缩放；可使用双击或聚焦后的滚轮。键盘方向键平移，加减号缩放，Home 复位。</span>
      <div className="world-map-stage">
        <svg ref={viewport.svg} viewBox={"0 0 360 " + mapHeight} preserveAspectRatio="xMidYMid meet" className="world-map-svg" tabIndex={0} role="group" aria-label="可拖拽缩放的点阵世界地图" aria-describedby={instructions} data-dragging={viewport.dragging} data-zoom={viewport.view.zoom.toFixed(3)} {...viewport.gestures}
          onDoubleClick={event => { if (!(event.target instanceof Element) || !event.target.closest("[data-map-place]")) viewport.zoomAt(1.5, event.clientX, event.clientY); }}
          onKeyDown={event => {
            if (event.target !== event.currentTarget) return;
            const keys: Record<string, () => void> = { "+": () => viewport.zoomAt(1.3), "=": () => viewport.zoomAt(1.3), "-": () => viewport.zoomAt(1 / 1.3), Home: viewport.reset, ArrowLeft: () => viewport.pan(20, 0), ArrowRight: () => viewport.pan(-20, 0), ArrowUp: () => viewport.pan(0, 12), ArrowDown: () => viewport.pan(0, -12) };
            if (keys[event.key]) { event.preventDefault(); keys[event.key](); }
          }}
          onClick={event => {
            if (viewport.clickSuppressed.current || !(event.target instanceof Element)) return;
            const code = event.target.closest("[data-country]")?.getAttribute("data-country");
            if (code && data.places.some(place => place.code === code)) {
              trigger.current = root.current?.querySelector<SVGGElement>('[data-map-place="' + code + '"]') ?? null;
              setSelected(selected === code ? null : code);
            }
          }}>
          <g className="world-map-camera" transform={"translate(" + (180 + viewport.view.x) + " " + (mapHeight / 2 + viewport.view.y) + ") scale(" + viewport.view.zoom + ") translate(-180 " + (-mapHeight / 2) + ")"}>
          <Land mobile={mobile} />
          {places.map(place => (
            <g key={place.code} data-map-place={place.code} data-tone={place.tone} className="world-map-marker" role="button" tabIndex={0}
              aria-label={place.label + "，" + place.nodes.length + " 台，在线 " + place.online + "，离线 " + place.offline + (place.pending ? "，待确认 " + place.pending : "")}
              aria-pressed={active?.code === place.code}
              onPointerUp={event => { if (event.pointerType === "touch" && !viewport.clickSuppressed.current) { lastMarkerTouch.current = performance.now(); trigger.current = event.currentTarget; setSelected(active?.code === place.code ? null : place.code); } }}
              onClick={event => { if (viewport.clickSuppressed.current || performance.now() - lastMarkerTouch.current < 600) return; trigger.current = event.currentTarget; setSelected(active?.code === place.code ? null : place.code); }}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault(); trigger.current = event.currentTarget;
                  setSelected(active?.code === place.code ? null : place.code);
                }
              }}>
              <title>{place.label + " · " + place.nodes.length + " 台服务器"}</title>
              <circle cx={place.x} cy={place.y} r={8} fill="transparent" />
              <circle className="world-map-marker-halo" cx={place.x} cy={place.y} r={5.2} fill="currentColor" opacity={0.16} />
              <circle className="world-map-marker-core" cx={place.x} cy={place.y} r={2.4} fill="currentColor" />
            </g>
          ))}
          </g>
        </svg>
        <span className="sr-only">{data.total === 0 ? "暂无服务器" : data.places.length === 0 ? "暂无可定位的服务器" : ""}</span>
      </div>
      {active && <div className="world-map-glass world-map-popover" data-map-panel role="region" aria-label={active.label + "服务器"}>
        <div className="world-map-popover-head">
          <span><Flag region={active.code} size={14} />{active.label} · {active.nodes.length} 台</span>
          <button type="button" aria-label="关闭地区详情" onClick={() => { setSelected(null); restoreFocus(); }}><X size={15} /></button>
        </div>
        <div className="world-map-node-list">{active.nodes.map(node =>
          <Link key={node.uuid} to={"/instance/" + encodeURIComponent(node.uuid)} className="world-map-node-link">
            <i data-tone={node.online === true ? "all" : node.online === false ? "none" : "unknown"} />
            <span>{node.name}</span><small>{node.online === true ? "在线" : node.online === false ? "离线" : "待确认"}</small><ChevronRight size={13} />
          </Link>)}</div>
      </div>}
    </section>
  );
}
export const NodeWorldMap = memo(NodeWorldMapBase, (a, b) => {
  if (a.nodes.length !== b.nodes.length) return false;
  return a.nodes.every((x, i) => {
    const y = b.nodes[i];
    return x.uuid === y.uuid && x.region === y.region && x.online === y.online && a.nameByUuid?.get(x.uuid) === b.nameByUuid?.get(y.uuid);
  });
});
