import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { useExpiryFilter } from "@/hooks/useExpiryFilter";

import { Flag } from "@/components/ui/Flag";
import { FloatingAssetButton } from "@/components/cost/FloatingAssetButton";
import { MapOverview } from "@/components/node/MapOverview";
import { useAuth } from "@/hooks/useAuth";
import {
  useAllNodeMeta,
  useHomeNodeSummaries,
  useNodeStoreStatus,
} from "@/hooks/useNode";
import { useHomepagePingOverview } from "@/hooks/usePingOverview";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { useViewMode } from "@/hooks/useViewMode";
import { calculateCostSummary, getExchangeRates } from "@/utils/cost";
import { useHiddenNodeUuids } from "@/hooks/useVisibleNodes";
import {
  getHomeGroupLabel,
  getHomeGroupOptions,
  getHomeRegionOptions,
  hasUngroupedNodes,
  HOME_ALL_GROUP,
  HOME_ALL_REGION,
  HOME_UNGROUPED,
  sortHomeGroupOptions,
  type HomeRegionOption,
} from "@/utils/homeNodes";
import { getDisplayRegionCode } from "@/utils/geo";
import { useHomeNodeOrder } from "@/hooks/useHomeNodeOrder";
import { useHourlyClock } from "@/hooks/useClock";
import { preloadAssetsPage } from "@/services/assetsPageLoader";
import { TodayTrafficStatsProvider } from "@/hooks/useTodayTrafficStats";

import { CompactNodeCard } from "./CompactNodeCard";
import { MiniNodeCard } from "./MiniNodeCard";
import { NodeCard } from "./NodeCard";
import { NodeListView } from "./NodeListView";
import type { NodeViewMode } from "@/utils/themeSettings";

// 卡片视图网格密度；列表档由独立组件布局。
const GRID_LAYOUT: Record<NodeViewMode, { className: string; minColumnWidth: number }> = {
  large: { className: "grid gap-4 xl:gap-5", minColumnWidth: 360 },
  compact: { className: "grid gap-3 xl:gap-4", minColumnWidth: 340 },
  mini: { className: "grid gap-3 xl:gap-3.5", minColumnWidth: 260 },
  // 占位以满足 Record 穷尽。
  list: { className: "", minColumnWidth: 0 },
};

type MiniGridStyle = CSSProperties & { "--mini-card-min-width": string };

// 标准 UUID 不含逗号，可安全拼成稳定签名。
const UUID_KEY_SEPARATOR = ",";

type IdleCapableWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

interface HomeOverview {
  trafficUp: number;
  trafficDown: number;
  netUp: number;
  netDown: number;
  totalRamUsed: number;
  totalRamTotal: number;
  totalDiskUsed: number;
  totalDiskTotal: number;
}

function HomeBrand({ siteName }: { siteName: string }) {
  return (
    <header className="home-brand sr-only" aria-label="站点名称">
      <h1 className="home-brand-title" title={siteName}>
        {siteName}
      </h1>
    </header>
  );
}

function GroupTabs({
  groups,
  hasUngrouped,
  selectedGroup,
  onSelectGroup,
}: {
  groups: string[];
  hasUngrouped?: boolean;
  selectedGroup: string;
  onSelectGroup: (group: string) => void;
}) {
  return (
    <div className="home-group-tabs" role="group" aria-label="服务器分组">
      <button
        type="button"
        aria-pressed={selectedGroup === HOME_ALL_GROUP}
        data-active={selectedGroup === HOME_ALL_GROUP ? "true" : "false"}
        onClick={() => onSelectGroup(HOME_ALL_GROUP)}
      >
        全部
      </button>
      {groups.map((group) => (
        <button
          key={group}
          type="button"
          aria-pressed={selectedGroup === group}
          data-active={selectedGroup === group ? "true" : "false"}
          onClick={() => onSelectGroup(group)}
          title={group}
        >
          {group}
        </button>
      ))}
      {hasUngrouped && groups.length > 0 && (
        <button
          type="button"
          aria-pressed={selectedGroup === HOME_UNGROUPED}
          data-active={selectedGroup === HOME_UNGROUPED ? "true" : "false"}
          onClick={() => onSelectGroup(HOME_UNGROUPED)}
          title="未分组"
        >
          未分组
        </button>
      )}
    </div>
  );
}

// 地区筛选栏:按国旗聚合节点,点击某地区只看该地区;再点一次(或点已选中项)回到全部。
// 与分组栏是两条独立筛选,可叠加(先分组、后地区)。
function RegionTabs({
  regions,
  selectedRegion,
  onSelectRegion,
}: {
  regions: HomeRegionOption[];
  selectedRegion: string;
  onSelectRegion: (region: string) => void;
}) {
  return (
    <section className="home-region-bar" aria-label="地区筛选">
      <div className="home-region-chips" role="group">
        {regions.map(({ code, count }) => {
          const active = selectedRegion === code;
          return (
            <button
              key={code}
              type="button"
              className="home-region-chip"
              data-active={active ? "true" : "false"}
              aria-pressed={active}
              onClick={() => onSelectRegion(active ? HOME_ALL_REGION : code)}
              title={code}
            >
              <Flag region={code} size={14} />
              <span className="home-region-chip-code">{code}</span>
              <span className="home-region-chip-count">{count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function NodeGrid() {
  const now = useHourlyClock();
  const nodes = useHomeNodeSummaries();
  const allMeta = useAllNodeMeta();
  const { hydrated: storeHydrated, nodeInfoError } = useNodeStoreStatus();
  const { data: me } = useAuth();
  const { data: publicConfig } = usePublicConfig();
  const siteName = publicConfig?.sitename?.trim() || "节点概览";
  const themeSettings = useThemeSettings();
  const { mode } = useViewMode();
  const sortField = themeSettings.homeSortField;
  const sortDirection = themeSettings.homeSortDirection;
  const [selectedGroup, setSelectedGroup] = useState(HOME_ALL_GROUP);
  const [selectedRegion, setSelectedRegion] = useState(HOME_ALL_REGION);
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [expiringOnly, setExpiringOnly] = useState(false);
  useHomepagePingOverview(mode);

  // 摘要不含名称，先从完整 meta 解析主题隐藏列表，再统一过滤各类数据。
  const hiddenUuids = useHiddenNodeUuids();
  const visibleNodes = useMemo(
    () =>
      nodes.filter(
        (node) => (me?.logged_in === true || !node.hidden) && !hiddenUuids.has(node.uuid),
      ),
    [me?.logged_in, nodes, hiddenUuids],
  );
  // 资产统计与卡片使用同一可见性规则，避免泄露隐藏节点信息。
  const visibleMeta = useMemo(
    () =>
      allMeta.filter(
        (node) => (me?.logged_in === true || !node.hidden) && !hiddenUuids.has(node.uuid),
      ),
    [allMeta, me?.logged_in, hiddenUuids],
  );
  const trafficUuids = useMemo(() => visibleMeta.map((node) => node.uuid), [visibleMeta]);
  const expiry = useExpiryFilter(visibleMeta);
  const expiryOrder = useMemo(() => new Map(expiry.expiringNodes.map((node, index) => [node.uuid, index])), [expiry.expiringNodes]);
  const clearExpiry = () => setExpiringOnly(false);
  // 「名称」排序需要展示名(摘要无 name),从 meta 注入。
  const nameByUuid = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of visibleMeta) map.set(node.uuid, node.name?.trim() || node.uuid);
    return map;
  }, [visibleMeta]);

  const groupOptions = useMemo(
    () =>
      sortHomeGroupOptions(
        getHomeGroupOptions(visibleNodes),
        themeSettings.isReady ? themeSettings.homeGroupOrder : [],
      ),
    [visibleNodes, themeSettings.homeGroupOrder, themeSettings.isReady],
  );
  const hasUngrouped = useMemo(() => hasUngroupedNodes(visibleNodes), [visibleNodes]);
  const isUngroupedTabEnabled =
    themeSettings.isReady && themeSettings.showUngroupedTab && hasUngrouped;
  const groupFilteredNodes = useMemo(() => {
    if (selectedGroup === HOME_ALL_GROUP) return visibleNodes;
    if (selectedGroup === HOME_UNGROUPED) {
      return isUngroupedTabEnabled
        ? visibleNodes.filter((node) => !getHomeGroupLabel(node.group))
        : visibleNodes;
    }
    return visibleNodes.filter((node) => getHomeGroupLabel(node.group) === selectedGroup);
  }, [visibleNodes, selectedGroup, isUngroupedTabEnabled]);

  const overviewNodes =
    themeSettings.isReady && themeSettings.overviewFollowGroup
      ? groupFilteredNodes
      : visibleNodes;

  const overview = useMemo<HomeOverview>(() => {
    let trafficUp = 0;
    let trafficDown = 0;
    let netUp = 0;
    let netDown = 0;
    let totalRamUsed = 0;
    let totalRamTotal = 0;
    let totalDiskUsed = 0;
    let totalDiskTotal = 0;

    for (const node of overviewNodes) {
      if (node.online === true) {
        totalRamUsed += node.ramUsed || 0;
        totalDiskUsed += node.diskUsed || 0;
      }
      totalRamTotal += node.ramTotal || 0;
      totalDiskTotal += node.diskTotal || 0;
      trafficUp += node.totalUp ?? node.trafficUp;
      trafficDown += node.totalDown ?? node.trafficDown;
      if (node.online === true) {
        netUp += node.netUp;
        netDown += node.netDown;
      }
    }


    return {
      trafficUp,
      trafficDown,
      netUp,
      netDown,
      totalRamUsed,
      totalRamTotal,
      totalDiskUsed,
      totalDiskTotal,
    };
  }, [overviewNodes]);

  const showHomeOverview = themeSettings.isReady && themeSettings.showHomeOverview;
  const showTrafficPopover = themeSettings.isReady && themeSettings.showTodayTrafficPopover;
  const loggedIn = Boolean(me?.logged_in);
  const hasNodes = visibleMeta.length > 0;
  const canAccessAssets = loggedIn || themeSettings.showPriceForGuests;
  // 卡内入口与悬浮入口互斥，避免重复操作入口。
  const showAssetCard = showHomeOverview && hasNodes;
  const showCostDetailButton =
    showAssetCard && themeSettings.isReady && themeSettings.showCostSummary && canAccessAssets;
  const showCostFloatingButton =
    themeSettings.isReady &&
    themeSettings.showCostSummaryFloatingButton &&
    hasNodes &&
    canAccessAssets &&
    !showCostDetailButton;

  useEffect(() => {
    if (!showCostDetailButton && !showCostFloatingButton) return;

    const idleWindow = window as IdleCapableWindow;
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(preloadAssetsPage, { timeout: 2_000 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    // Safari 等无 requestIdleCallback 的浏览器，在首页稳定后再低优先级预取。
    const handle = window.setTimeout(preloadAssetsPage, 1_000);
    return () => window.clearTimeout(handle);
  }, [showCostDetailButton, showCostFloatingButton]);

  // 资产入口存在时预热汇率，供概览、价格排序和资产页复用。
  const costNeeded = showAssetCard || showCostFloatingButton;
  const rateQuery = useQuery({
    queryKey: ["cost-rates", themeSettings.costRateApiUrl],
    queryFn: ({ signal }) => getExchangeRates(themeSettings.costRateApiUrl, { signal }),
    staleTime: 60 * 60 * 1000,
    // 「价格」排序也要汇率换算月化价,即便没显示资产卡也得拉一次;但空列表无需拉。
    enabled: (costNeeded || sortField === "price") && hasNodes,
    retry: 1,
  });
  const costSummary = useMemo(
    () =>
      rateQuery.data
        ? calculateCostSummary(
          visibleMeta,
          themeSettings.costIgnoredNodes,
          rateQuery.data.rates,
          themeSettings.costPremiums,
          now,
        )
        : null,
    [now, visibleMeta, themeSettings.costIgnoredNodes, themeSettings.costPremiums, rateQuery.data],
  );
  // 「价格」排序键:月化价格(CNY);免费/忽略/汇率缺失的节点 null,排到默认序之后。
  const priceByUuid = useMemo(() => {
    const map = new Map<string, number | null>();
    if (costSummary) {
      for (const detail of costSummary.details) {
        map.set(detail.uuid, detail.counted ? detail.monthlyCny : null);
      }
    }
    return map;
  }, [costSummary]);
  const costLoading = costNeeded && rateQuery.isLoading;
  const overviewCostSummary = useMemo(() => {
    if (!costSummary) return null;
    const ids = new Set(overviewNodes.map(node => node.uuid));
    return { remainingCny: costSummary.details.reduce((sum, detail) =>
      sum + (ids.has(detail.uuid) && detail.counted ? detail.remainingCny : 0), 0) };
  }, [costSummary, overviewNodes]);
  // 地区选项在分组筛选之后统计,让国旗计数反映当前分组内的分布。
  const regionOptions = useMemo(
    () => getHomeRegionOptions(groupFilteredNodes),
    [groupFilteredNodes],
  );
  const regionFilteredNodes = useMemo(
    () =>
      selectedRegion === HOME_ALL_REGION
        ? groupFilteredNodes
        : groupFilteredNodes.filter((node) => getDisplayRegionCode(node.region) === selectedRegion),
    [groupFilteredNodes, selectedRegion],
  );
  // Status is applied only to the list, so overview counts and map remain stable.
  const filteredNodes = useMemo(() => expiringOnly
    ? visibleNodes.filter(node => expiryOrder.has(node.uuid))
    : offlineOnly ? regionFilteredNodes.filter(node => node.online === false) : regionFilteredNodes,
  [expiringOnly, visibleNodes, expiryOrder, regionFilteredNodes, offlineOnly]);
  // 排序在分组筛选之后。离线永远沉底(写死,见 homeSort);实时网速走防抖(键平滑+滞回+5s 重排)。
  const defaultOrderedNodes = useHomeNodeOrder({
    nodes: filteredNodes,
    field: sortField,
    direction: sortDirection,
    nameByUuid,
    priceByUuid,
  });
  const orderedNodes = useMemo(() => expiringOnly
    ? [...filteredNodes].sort((a, b) => expiryOrder.get(a.uuid)! - expiryOrder.get(b.uuid)!)
    : defaultOrderedNodes, [expiringOnly, filteredNodes, expiryOrder, defaultOrderedNodes]);

  useEffect(() => {
    if (
      selectedGroup !== HOME_ALL_GROUP &&
      selectedGroup !== HOME_UNGROUPED &&
      !groupOptions.includes(selectedGroup)
    ) {
      setSelectedGroup(HOME_ALL_GROUP);
    } else if (selectedGroup === HOME_UNGROUPED && !hasUngrouped) {
      setSelectedGroup(HOME_ALL_GROUP);
    }
  }, [groupOptions, hasUngrouped, selectedGroup]);

  // 选中的地区在当前分组里不存在了(切换分组/节点变化)就回到全部。
  useEffect(() => {
    if (
      selectedRegion !== HOME_ALL_REGION &&
      !regionOptions.some((option) => option.code === selectedRegion)
    ) {
      setSelectedRegion(HOME_ALL_REGION);
    }
  }, [regionOptions, selectedRegion]);

  // 地区栏被配置关闭(热更新)时,清掉可能残留的地区筛选,否则会留下一个不可见的过滤条件。
  useEffect(() => {
    if (!themeSettings.showRegionBar && selectedRegion !== HOME_ALL_REGION) {
      setSelectedRegion(HOME_ALL_REGION);
    }
  }, [themeSettings.showRegionBar, selectedRegion]);

  useEffect(() => {
    if (!themeSettings.showGroupTabs && selectedGroup !== HOME_ALL_GROUP) {
      setSelectedGroup(HOME_ALL_GROUP);
    } else if (!isUngroupedTabEnabled && selectedGroup === HOME_UNGROUPED) {
      setSelectedGroup(HOME_ALL_GROUP);
    }
  }, [themeSettings.showGroupTabs, isUngroupedTabEnabled, selectedGroup]);

  // 卡片列表只随 UUID 集合/顺序变化；卡片内部各自订阅实时数据。
  const uuidsKey = useMemo(
    () => orderedNodes.map((node) => node.uuid).join(UUID_KEY_SEPARATOR),
    [orderedNodes],
  );
  const orderedUuids = useMemo(
    () => (uuidsKey ? uuidsKey.split(UUID_KEY_SEPARATOR) : []),
    [uuidsKey],
  );
  // 列表档由下方 NodeListView 渲染,这里不必构造卡片元素。
  const cards = useMemo(
    () =>
      mode === "list"
        ? null
        : orderedUuids.map((uuid) => (
          <div key={uuid} className="min-w-0">
            {mode === "mini" ? (
              <MiniNodeCard
                uuid={uuid}
                showTodayTraffic={showTrafficPopover}
              />
            ) : mode === "compact" ? (
              <CompactNodeCard
                uuid={uuid}
                showTodayTraffic={showTrafficPopover}
              />
            ) : (
              <NodeCard
                uuid={uuid}
                showTodayTraffic={showTrafficPopover}
              />
            )}
          </div>
        )),
    [orderedUuids, mode, showTrafficPopover],
  );
  const showGroupTabs =
    themeSettings.isReady && themeSettings.showGroupTabs && groupOptions.length > 0;
  // 地区栏:只有一个地区时筛选无意义,>1 才显示。
  const showRegionBar =
    themeSettings.isReady && themeSettings.showRegionBar && regionOptions.length > 1;
  // 分组标签栏与卡片网格共用列定义，让标签栏左缘对齐首卡。
  const isMini = mode === "mini";
  const isList = mode === "list";
  const { className: gridClassName, minColumnWidth } = GRID_LAYOUT[mode];
  const gridWrapClassName = isMini ? `${gridClassName} node-grid-mini` : gridClassName;
  const gridStyle = isList
    ? undefined
    : isMini
      ? ({ "--mini-card-min-width": `${minColumnWidth}px` } as MiniGridStyle)
      : { gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minColumnWidth}px), 1fr))` };
  const gridElement = (
    <div className={gridWrapClassName} style={gridStyle}>
      {cards}
    </div>
  );
  // 迷你与列表档的控件栏借用小卡列宽，避免跟随密集内容列而被压窄。
  const borrowControlsGrid = isMini || isList;
  const controlsWrapClassName = borrowControlsGrid
    ? "grid gap-3 home-controls-bar mb-4"
    : `${gridWrapClassName} home-controls-bar mb-4`;
  const controlsStyle = borrowControlsGrid
    ? {
      gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${GRID_LAYOUT.compact.minColumnWidth}px), 1fr))`,
    }
    : gridStyle;

  if (!themeSettings.isReady || !storeHydrated) {
    if (!nodeInfoError) return null;
    return (
      <div
        className="flex h-[40vh] flex-col items-center justify-center gap-2 text-(--text-tertiary)"
        aria-live="polite"
      >
        <span className="text-[14px]">节点数据暂时无法加载</span>
        <span className="text-[12px]">正在等待后端自动重试</span>
      </div>
    );
  }

  // 资产页悬浮入口 + 首页概览卡在「空节点」与正常两个分支里完全一致，提取一次复用。
  const homeHeader = (
    <>
      {showCostFloatingButton && <FloatingAssetButton />}
      <HomeBrand siteName={siteName} />
      {showHomeOverview && (
        <MapOverview
          nodes={overviewNodes}
          nameByUuid={nameByUuid}
          overview={overview}
          costSummary={overviewCostSummary}
          costLoading={costLoading}
          offlineOnly={offlineOnly}
          onToggleOffline={() => { clearExpiry(); setOfflineOnly(value => !value); }}
          showAssetLink={showCostDetailButton}
          showTrafficLink={themeSettings.showTrafficPageButton && (loggedIn || themeSettings.showTrafficPageForGuests)}
        />
      )}
    </>
  );

  if (visibleNodes.length === 0) {
    return (
      <>
        {homeHeader}
        <div className="flex h-[40vh] flex-col items-center justify-center gap-2 text-(--text-tertiary)">
          <span className="text-[15px]">尚未连接到任何节点</span>
          <span className="text-[12px]">等待后端推送或前往管理后台添加</span>
        </div>
      </>
    );
  }

  return (
    <>
      {homeHeader}
      <section
        className="mao-server-section"
        aria-label="服务器状态列表"
      >
        {showGroupTabs && (
          <div className={controlsWrapClassName} style={controlsStyle}>
            {showGroupTabs && (
              <GroupTabs
                groups={groupOptions}
                hasUngrouped={isUngroupedTabEnabled}
                selectedGroup={selectedGroup}
                onSelectGroup={group => { clearExpiry(); setSelectedGroup(group); }}
              />
            )}
          </div>
        )}
        <div className="home-filter-toolbar">
        {showRegionBar && (
          <RegionTabs
            regions={regionOptions}
            selectedRegion={selectedRegion}
            onSelectRegion={region => { clearExpiry(); setSelectedRegion(region); }}
          />
        )}
        <button type="button" className="home-expiry-button" aria-pressed={expiringOnly}
          title={expiry.message} onClick={() => {
            if (!expiringOnly) {
              setSelectedGroup(HOME_ALL_GROUP); setSelectedRegion(HOME_ALL_REGION); setOfflineOnly(false);
              if (expiry.loggedIn) void expiry.retry();
            }
            setExpiringOnly(value => !value);
          }}>
          <CalendarClock size={15} aria-hidden="true" />
          即将到期
          {expiry.days != null && expiry.days > 0 && <span className="home-region-chip-count">{expiry.expiringNodes.length}</span>}
        </button>
        </div>
        {expiringOnly && <div className="home-expiry-status" role="status">
          <span>{expiry.message}</span>
          {!expiry.loggedIn && <a href="/admin/">登录后台</a>}
          {expiry.isError && <button type="button" onClick={() => void expiry.retry()}>重试</button>}
          <button type="button" onClick={clearExpiry}>显示全部</button>
        </div>}
        {offlineOnly && <div className="home-status-filter" role="status"><button type="button" aria-label="清除离线筛选，显示全部节点" onClick={() => setOfflineOnly(false)}>仅看离线 · {filteredNodes.length} <span aria-hidden="true">×</span></button></div>}
        {expiringOnly && filteredNodes.length === 0 ? <div className="home-filter-empty" role="status">{expiry.days != null && expiry.days > 0 ? `未来 ${expiry.days} 天内没有即将到期的服务器` : expiry.message}</div> : offlineOnly && filteredNodes.length === 0 ? <div className="home-filter-empty" role="status">当前筛选中没有离线节点<button type="button" onClick={() => setOfflineOnly(false)}>返回全部节点</button></div> : isList ? (
          <NodeListView uuids={orderedUuids} />
        ) : showTrafficPopover ? (
          <TodayTrafficStatsProvider uuids={trafficUuids}>
            {gridElement}
          </TodayTrafficStatsProvider>
        ) : (
          gridElement
        )}
      </section>
    </>
  );
}
