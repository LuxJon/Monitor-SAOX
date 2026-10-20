// Phone display projection keeps all longitudes visible while giving the map
// more vertical detail. Both country paths and live markers use this transform.
import { MAP_H, MAP_TOP, MAP_BOTTOM } from "./worldMapProjection";

const degrees = 180 / Math.PI;
const mercator = (latitude: number) => degrees * Math.log(Math.tan(Math.PI / 4 + latitude / degrees / 2));
const north = mercator(MAP_TOP);
export const MOBILE_MAP_HEIGHT = north - mercator(MAP_BOTTOM);

export function mobileMapY(y: number): number {
  const latitude = Math.max(MAP_BOTTOM, Math.min(MAP_TOP, MAP_TOP - y));
  return north - mercator(latitude);
}

// Source paths are quantized into the same 360×144 equirectangular extent
// as nodeWorldMap. Reproject path vertices once, before SVG rendering.
export function mobileCountryPath(d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) =>
    (Number(x) * .36).toFixed(3) + " " + mobileMapY(Number(y) * .3598971722).toFixed(3));
}

export function mapDisplayHeight(mobile: boolean): number {
  return mobile ? MOBILE_MAP_HEIGHT : MAP_H;
}
