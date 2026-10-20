import { memo } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { mapDisplayHeight } from "@/utils/worldMapDisplay";

/**
 * 首页磨砂骨架屏 (HomeSkeleton)
 * 在首屏数据尚未抵达前提供与真实 SAO 仪表盘严格对齐的立体占位骨架，
 * 消除空荡荡的白屏与转圈，实现视觉上的“即开即见”。
 */
export const HomeSkeleton = memo(function HomeSkeleton() {
  const mobile = useMediaQuery("(max-width: 600px)");
  return (
    <div className="home-skeleton-container space-y-6 animate-pulse" aria-hidden="true">
      {/* 无边框地图与独立状态占位。 */}
      <div className="relative">
        <div className="node-world-map rounded-full bg-(--bg-card) opacity-30" style={{ aspectRatio: 360 / mapDisplayHeight(mobile) }} />
        <div className="map-overview-stats">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="map-stat-card bg-(--bg-card)/50">
              <div className="h-3 w-12 rounded bg-(--border-subtle) opacity-60" />
              <div className="h-5 w-16 rounded bg-(--border-subtle) opacity-70" />
            </div>
          ))}
        </div>
      </div>

      {/* 节点控制栏占位 */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-(--bg-card) opacity-75" />
          <div className="h-8 w-20 rounded-lg bg-(--bg-card) opacity-50" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-(--bg-card) opacity-60" />
      </div>

      {/* 节点卡片网格占位 (4张大卡) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-6 w-8 rounded bg-(--border-subtle) opacity-70" />
                <div className="h-4 w-28 rounded bg-(--border-subtle) opacity-80" />
              </div>
              <div className="h-4 w-16 rounded bg-(--border-subtle) opacity-60" />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="space-y-1.5">
                <div className="h-3 w-10 rounded bg-(--border-subtle) opacity-50" />
                <div className="h-4 w-14 rounded bg-(--border-subtle) opacity-75" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-10 rounded bg-(--border-subtle) opacity-50" />
                <div className="h-4 w-14 rounded bg-(--border-subtle) opacity-75" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-10 rounded bg-(--border-subtle) opacity-50" />
                <div className="h-4 w-14 rounded bg-(--border-subtle) opacity-75" />
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-(--border-subtle) opacity-40" />
            <div className="h-7 w-full rounded-lg bg-(--bg-surface) opacity-50" />
          </div>
        ))}
      </div>
    </div>
  );
});
