import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type MapView = { x: number; y: number; zoom: number };
const INITIAL: MapView = { x: 0, y: 0, zoom: 1 };
export function boundMapView(view: MapView, height = 144): MapView {
  const zoom = Math.min(4, Math.max(1, view.zoom));
  const limitX = 180 * (zoom - 1) + 72;
  const limitY = height / 2 * (zoom - 1) + height * (28 / 144);
  return { zoom, x: Math.max(-limitX, Math.min(limitX, view.x)), y: Math.max(-limitY, Math.min(limitY, view.y)) };
}
export function useMapViewport(height = 144) {
  const svg = useRef<SVGSVGElement>(null);
  const [view, setView] = useState(INITIAL);
  const current = useRef(INITIAL);
  const frame = useRef(0);
  const clickSuppressed = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const velocity = useRef({ x: 0, y: 0, time: 0 });
  const dragOrigin = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const commit = useCallback((next: MapView) => { current.current = boundMapView(next, height); setView(current.current); }, [height]);
  const stop = useCallback(() => { cancelAnimationFrame(frame.current); }, []);
  useEffect(() => stop, [stop, height]);
  const animate = useCallback((next: MapView) => {
    stop(); const target = boundMapView(next, height), from = current.current;
    if (reduced()) { commit(target); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 260), eased = 1 - (1 - t) ** 3;
      commit({ x: from.x + (target.x - from.x) * eased, y: from.y + (target.y - from.y) * eased, zoom: from.zoom + (target.zoom - from.zoom) * eased });
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [commit, stop, height]);
  const zoomAt = useCallback((factor: number, clientX?: number, clientY?: number, smooth = true) => {
    const box = svg.current?.getBoundingClientRect(); if (!box) return;
    const scale = Math.min(box.width / 360, box.height / height);
    const anchorX = clientX === undefined ? 0 : (clientX - box.x - box.width / 2) / scale;
    const anchorY = clientY === undefined ? 0 : (clientY - box.y - box.height / 2) / scale;
    const old = current.current, zoom = Math.min(4, Math.max(1, old.zoom * factor)), ratio = zoom / old.zoom;
    const next = { zoom, x: anchorX - (anchorX - old.x) * ratio, y: anchorY - (anchorY - old.y) * ratio };
    if (smooth) animate(next); else commit(next);
  }, [animate, commit, height]);
  useEffect(() => {
    const el = svg.current; if (!el) return;
    const wheel = (event: WheelEvent) => {
      // Leave ordinary page scrolling available; focus the map or use Ctrl/pinch to zoom.
      if (!event.ctrlKey && !event.metaKey && !el.contains(document.activeElement)) return;
      event.preventDefault(); stop(); zoomAt(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .003), event.clientX, event.clientY, false);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoomAt, stop]);
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stop(); if (!pointers.current.size) { clickSuppressed.current = false; dragOrigin.current = { x: event.clientX, y: event.clientY }; }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    velocity.current = { x: 0, y: 0, time: performance.now() };
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const before = pointers.current.get(event.pointerId), box = svg.current?.getBoundingClientRect(); if (!before || !box) return;
    const previous = [...pointers.current.values()];
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...pointers.current.values()], scale = Math.min(box.width / 360, box.height / height);
    if (after.length > 1) {
      clickSuppressed.current = true;
      const distance = (p: { x: number; y: number }[]) => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
      const oldDistance = distance(previous);
      if (oldDistance > 1) zoomAt(distance(after) / oldDistance, (after[0].x + after[1].x) / 2, (after[0].y + after[1].y) / 2, false);
    } else {
      if (!clickSuppressed.current && Math.hypot(event.clientX - dragOrigin.current.x, event.clientY - dragOrigin.current.y) < 4) return;
      clickSuppressed.current = true;
      const dx = (event.clientX - before.x) / scale, dy = (event.clientY - before.y) / scale;
      const now = performance.now(), dt = Math.max(8, now - velocity.current.time);
      velocity.current = { x: dx / dt, y: dy / dt, time: now };
      commit({ ...current.current, x: current.current.x + dx, y: current.current.y + dy });
    }
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const finish = (event: ReactPointerEvent<SVGSVGElement>, cancelled = false) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointers.current.size) { velocity.current = { x: 0, y: 0, time: performance.now() }; return; }
    setDragging(false);
    if (cancelled || !clickSuppressed.current || reduced() || performance.now() - velocity.current.time > 100) return;
    let vx = Math.max(-.7, Math.min(.7, velocity.current.x)), vy = Math.max(-.7, Math.min(.7, velocity.current.y)), last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(32, now - last); last = now; const decay = Math.pow(.9, dt / 16); vx *= decay; vy *= decay;
      commit({ ...current.current, x: current.current.x + vx * dt, y: current.current.y + vy * dt });
      if (Math.abs(vx) + Math.abs(vy) > .008) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  return { svg, view, dragging, clickSuppressed, zoomAt, reset: () => animate(INITIAL), pan: (x: number, y: number) => animate({ ...current.current, x: current.current.x + x, y: current.current.y + y }),
    gestures: { onPointerDown, onPointerMove, onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => finish(e), onPointerCancel: (e: ReactPointerEvent<SVGSVGElement>) => finish(e, true), onLostPointerCapture: (e: ReactPointerEvent<SVGSVGElement>) => { if (e.target === e.currentTarget && pointers.current.has(e.pointerId)) { pointers.current.clear(); setDragging(false); stop(); } } } };
}
