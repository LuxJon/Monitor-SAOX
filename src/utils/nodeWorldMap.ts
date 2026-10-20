import type { HomeNodeSummary } from "@/services/wsStore";
import { getCountryCodeFromRegion } from "@/utils/geo";
import { placeOf } from "@/utils/worldMapProjection";

export type MapTone = "all" | "some" | "none" | "unknown";
export interface MapNode { uuid: string; name: string; online: boolean | null }
export interface MapPlace {
  code: string;
  label: string;
  x: number;
  y: number;
  nodes: MapNode[];
  online: number;
  offline: number;
  pending: number;
  tone: MapTone;
}
const regionNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });

export function buildNodeMap(nodes: HomeNodeSummary[], names?: Map<string, string>) {
  const grouped = new Map<string, MapPlace>();
  let online = 0;
  let offline = 0;
  let pending = 0;
  let unmapped = 0;
  for (const node of nodes) {
    if (node.online === true) online++;
    else if (node.online === false) offline++;
    else pending++;
    const code = getCountryCodeFromRegion(node.region);
    const point = code ? placeOf(code) : null;
    if (!code || !point) { unmapped++; continue; }
    let place = grouped.get(code);
    if (!place) {
      place = { code, label: regionNames.of(code) ?? code, x: point[0], y: point[1], nodes: [], online: 0, offline: 0, pending: 0, tone: "unknown" };
      grouped.set(code, place);
    }
    place.nodes.push({ uuid: node.uuid, name: names?.get(node.uuid) || node.uuid, online: node.online });
    if (node.online === true) place.online++;
    else if (node.online === false) place.offline++;
    else place.pending++;
  }
  const places = [...grouped.values()].sort((a, b) => a.code.localeCompare(b.code));
  for (const place of places) {
    place.tone = place.pending > 0 ? "unknown" : place.offline === 0 ? "all" : place.online === 0 ? "none" : "some";
  }
  return { places, total: nodes.length, online, offline, pending, unmapped };
}
