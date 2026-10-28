import { useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CalendarClock, ChevronDown, ChevronLeft, ChevronUp, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Flag } from "@/components/ui/Flag";
import { Spinner } from "@/components/ui/Spinner";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useHourlyClock } from "@/hooks/useClock";
import { useVisibleNodes } from "@/hooks/useVisibleNodes";
import { useAuth } from "@/hooks/useAuth";
import { useExpiryFilter } from "@/hooks/useExpiryFilter";
import { useHomeNodeSummaries } from "@/hooks/useNode";
import { useHomeNodeOrder } from "@/hooks/useHomeNodeOrder";
import {
  calculateCostSummary,
  formatCnyMoney,
  getExchangeRates,
} from "@/utils/cost";
import { formatBillingCycle } from "@/utils/billing";
import { getExpireDaysRemaining, LONG_TERM_EXPIRE_DAYS } from "@/utils/format";

type AssetDetail = ReturnType<typeof calculateCostSummary>["details"][number];
type AssetsSortField =
  | "weight"
  | "price"
  | "remaining"
  | "monthly"
  | "expiry";
type AssetsSortDirection = "asc" | "desc";

const NATURAL_DIRECTION: Record<AssetsSortField, AssetsSortDirection> = {
  weight: "asc",
  price: "desc",
  remaining: "desc",
  monthly: "desc",
  expiry: "asc",
};

const TABLE_COLUMNS: Array<{ field: AssetsSortField; label: string; numeric?: boolean }> = [
  { field: "weight", label: "节点" },
  { field: "price", label: "价格", numeric: true },
  { field: "remaining", label: "剩余价值", numeric: true },
  { field: "monthly", label: "月成本", numeric: true },
  { field: "expiry", label: "到期", numeric: true },
];

const MOBILE_SORT_OPTIONS: Array<{ field: AssetsSortField; label: string }> = [
  { field: "price", label: "价格" },
  { field: "monthly", label: "月成本" },
  { field: "expiry", label: "到期" },
];

const ASSETS_MOBILE_QUERY = "(max-width: 720px)";

function sortValue(detail: AssetDetail, field: AssetsSortField): number {
  switch (field) {
    case "price":
      return detail.priceCny;
    case "remaining":
      return detail.remainingCny;
    case "monthly":
      return detail.monthlyCny;
    case "expiry": {
      const days = getExpireDaysRemaining(detail.expiredAt, Date.now(), detail.expiresIn);
      return days == null ? Number.POSITIVE_INFINITY : days;
    }
    default:
      return detail.weight;
  }
}

function formatCostExpiry(expiredAt: string, expiresIn?: number | null) {
  const days = getExpireDaysRemaining(expiredAt, Date.now(), expiresIn);
  if (days == null) return "到期未知";
  if (days > LONG_TERM_EXPIRE_DAYS) return "长期";
  if (days < 0) return "已过期";
  if (days === 0) return "今日到期";
  return `${days} 天后到期`;
}

function formatMonthlyCost(detail: AssetDetail) {
  if (!detail.counted) return detail.note === "免费" ? formatCnyMoney(0) : "—";
  return detail.billingCycleDays > 0 ? formatCnyMoney(detail.monthlyCny) : "不适用";
}

function assetsRenewalTone(daysRemaining: number): "critical" | "warning" {
  return daysRemaining <= 3 ? "critical" : "warning";
}

function assetsRenewalLabel(daysRemaining: number) {
  return daysRemaining < 0 ? "已过期" : "即将到期";
}

// "¥ 1,234.56" → 货币符号 / 整数位 / 小数位三段,按报表数字惯例分级排印。
function HeroMoney({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="assets-hero-value is-pending">计算中</span>;
  }
  const [int, frac = "00"] = formatCnyMoney(value).replace("¥", "").trim().split(".");
  return (
    <span className="assets-hero-value">
      <span className="assets-hero-currency">¥</span>
      {int}
      <span className="assets-hero-frac">.{frac}</span>
    </span>
  );
}

export function Assets() {
  // No explicit selection: follow the same configured order and offline rules as home.
  const [sortField, setSortField] = useState<AssetsSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<AssetsSortDirection>("asc");
  const isMobileLayout = useMediaQuery(ASSETS_MOBILE_QUERY);
  const now = useHourlyClock();
  const themeSettings = useThemeSettings();
  const forceRateRefresh = useRef(false);
  const nodes = useVisibleNodes();
  const homeSummaries = useHomeNodeSummaries();
  // 资产详情页是风险核对入口：这里始终按真实到期数据展示，不读取首页的关闭/稍后偏好。
  const expiry = useExpiryFilter(nodes);
  const renewalReminders = useMemo(() => expiry.expiringNodes.map(node => ({
    uuid: node.uuid, daysRemaining: getExpireDaysRemaining(node.expired_at, now, node.expires_in)!,
  })), [expiry.expiringNodes, now]);
  const renewalByUuid = useMemo(
    () => new Map(renewalReminders.map((item) => [item.uuid, item])),
    [renewalReminders],
  );
  const rateQuery = useQuery({
    queryKey: ["cost-rates", themeSettings.costRateApiUrl],
    queryFn: ({ signal }) => {
      const ignoreCache = forceRateRefresh.current;
      forceRateRefresh.current = false;
      return getExchangeRates(themeSettings.costRateApiUrl, { signal, ignoreCache });
    },
    staleTime: 60 * 60 * 1000,
    enabled: themeSettings.isReady && nodes.length > 0,
    retry: 1,
  });
  const summary = useMemo(
    () =>
      rateQuery.data
        ? calculateCostSummary(
            nodes,
            themeSettings.costIgnoredNodes,
            rateQuery.data.rates,
            themeSettings.costPremiums,
            now,
          )
        : null,
    [nodes, now, themeSettings.costIgnoredNodes, themeSettings.costPremiums, rateQuery.data],
  );
  const nameByUuid = useMemo(() => new Map(nodes.map(node => [node.uuid, node.name?.trim() || node.uuid])), [nodes]);
  const visibleSummaries = useMemo(() => homeSummaries.filter(node => nameByUuid.has(node.uuid)), [homeSummaries, nameByUuid]);
  const priceByUuid = useMemo(() => new Map((summary?.details ?? []).map(detail => [detail.uuid, detail.counted ? detail.monthlyCny : null])), [summary]);
  const homeOrderedNodes = useHomeNodeOrder({
    nodes: visibleSummaries,
    field: themeSettings.homeSortField,
    direction: themeSettings.homeSortDirection,
    nameByUuid,
    priceByUuid,
  });
  const homeOrder = useMemo(() => new Map(homeOrderedNodes.map((node, index) => [node.uuid, index])), [homeOrderedNodes]);
  const detailRows = useMemo(() => {
    if (sortField == null) {
      return [...(summary?.details ?? [])].sort((a, b) =>
        (homeOrder.get(a.uuid) ?? Infinity) - (homeOrder.get(b.uuid) ?? Infinity));
    }
    const direction = sortDirection === "asc" ? 1 : -1;
    // 排序键先算好,避免比较器里 O(n log n) 次重复解析到期日。
    const rows = (summary?.details ?? []).map((detail) => ({
      detail,
      key: sortValue(detail, sortField),
    }));
    rows.sort((a, b) => {
      if (a.detail.counted !== b.detail.counted) return a.detail.counted ? -1 : 1;
      return (
        (a.key - b.key) * direction || a.detail.name.localeCompare(b.detail.name, "zh-CN")
      );
    });
    return rows.map(({ detail }) => detail);
  }, [sortDirection, sortField, summary, homeOrder]);
  const exchangeRateRows = useMemo(() => {
    if (!rateQuery.data?.rates.CNY) return [];
    const rates = rateQuery.data.rates;
    return ["USD", "CAD", "HKD", "EUR", "GBP", "JPY", "AUD", "SGD"]
      .map((code) => (rates[code] ? { code, value: rates.CNY / rates[code] } : null))
      .filter((item): item is { code: string; value: number } => Boolean(item));
  }, [rateQuery.data]);

  const handleSort = (field: AssetsSortField) => {
    if (field === sortField) {
      setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(NATURAL_DIRECTION[field]);
    }
  };

  const { data: me } = useAuth();
  const loggedIn = Boolean(me?.logged_in);

  if (!themeSettings.isReady) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  // 两个入口都关闭或对访客隐藏资产时，未登录访客直连 URL 回首页。
  if (
    (!themeSettings.showCostSummary && !themeSettings.showCostSummaryFloatingButton) ||
    (!loggedIn && !themeSettings.showPriceForGuests)
  ) {
    return <Navigate to="/" replace />;
  }

  const ledgerRows = [
    { label: "年化总支出", value: summary ? formatCnyMoney(summary.totalCny) : "--" },
    { label: "月成本合计", value: summary ? formatCnyMoney(summary.monthlyCny) : "--" },
  ];

  const directionIcon =
    sortDirection === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;

  return (
    <div className="assets-page flex flex-col gap-4 py-2">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="instance-page-back">
          <ChevronLeft size={14} />
          返回
        </Link>
        <button
          type="button"
          className={`cost-summary-action${rateQuery.isFetching ? " is-spinning" : ""}`}
          onClick={() => {
            forceRateRefresh.current = true;
            void rateQuery.refetch();
          }}
          disabled={rateQuery.isFetching}
          aria-busy={rateQuery.isFetching}
          aria-label="刷新汇率与统计"
          title="刷新"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {nodes.length === 0 ? (
        <div className="flex h-[40vh] flex-col items-center justify-center gap-2 text-(--text-tertiary)">
          <span className="text-[15px]">暂无节点数据</span>
          <span className="text-[12px]">等待后端推送或前往管理后台添加</span>
        </div>
      ) : (
        <>
          <section className="assets-hero" aria-label="资产汇总">
            <span className="assets-hero-mark" aria-hidden>
              ¥
            </span>
            <div className="assets-hero-main">
              <span className="assets-eyebrow" title="按后台账单价格换算人民币后的剩余价值">
                剩余价值
              </span>
              <HeroMoney value={summary ? summary.remainingCny : null} />
            </div>
            <dl className="assets-ledger">
              {ledgerRows.map((row) => (
                <div className="assets-ledger-row" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="assets-section-head">
            <span className="assets-eyebrow">明细</span>
            <span className="assets-count">{detailRows.length} 台</span>
            {renewalReminders.length > 0 && (
              <span className="assets-renewal-inline">
                <CalendarClock size={12} strokeWidth={2.1} />
                {renewalReminders.length} 台临期
              </span>
            )}
            <div className="assets-mobile-tools">
              <div className="cost-summary-sort-tabs" role="group" aria-label="排序字段">
                {MOBILE_SORT_OPTIONS.map((option) => (
                  <button
                    key={option.field}
                    type="button"
                    className="cost-summary-sort-tab"
                    data-active={sortField === option.field}
                    onClick={() => handleSort(option.field)}
                    aria-pressed={sortField === option.field}
                    title={sortField === option.field ? `当前${sortDirection === "asc" ? "升序" : "降序"}，点击切换` : `按${option.label}排序`}
                  >
                    {option.label}
                    {sortField === option.field && <span className="sr-only">，{sortDirection === "asc" ? "升序" : "降序"}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {summary ? (
            <>
              {!isMobileLayout ? (
                <div className="assets-table-wrap">
                <table className="assets-table">
                  <thead>
                    <tr>
                      {TABLE_COLUMNS.map((column) => (
                        <th
                          key={column.field}
                          data-numeric={column.numeric || undefined}
                          aria-sort={
                            sortField === column.field
                              ? sortDirection === "asc"
                                ? "ascending"
                                : "descending"
                              : undefined
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(column.field)}
                            data-active={sortField === column.field}
                          >
                            {column.label}
                            {sortField === column.field && directionIcon}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((detail) => {
                      const reminder = renewalByUuid.get(detail.uuid);
                      const renewalTone = reminder
                        ? assetsRenewalTone(reminder.daysRemaining)
                        : undefined;
                      const renewalLabel = reminder
                        ? assetsRenewalLabel(reminder.daysRemaining)
                        : undefined;
                      return (
                        <tr
                          key={detail.uuid}
                          data-counted={detail.counted}
                          data-renewal-tone={renewalTone}
                        >
                        <td>
                          <Link
                            to={`/instance/${encodeURIComponent(detail.uuid)}`}
                            className="assets-node-link"
                            title={detail.name}
                            data-node-id={detail.uuid}
                          >
                            <Flag region={detail.region} size={12} />
                            <span>{detail.name}</span>
                          </Link>
                        </td>
                        <td data-numeric>
                          {detail.counted ? (
                            `${formatCnyMoney(detail.priceCny)}/${formatBillingCycle(detail.billingCycleDays)}`
                          ) : (
                            <span className="assets-note-chip">{detail.note}</span>
                          )}
                        </td>
                        <td data-numeric data-strong>
                          {detail.counted ? formatCnyMoney(detail.remainingCny) : "—"}
                        </td>
                        <td data-numeric title="后台周期价格换算人民币 ÷ 计费月数">
                          {formatMonthlyCost(detail)}
                        </td>
                        <td data-numeric>
                          {reminder ? (
                            <span
                              className="assets-expiry-reminder"
                              data-tone={renewalTone}
                              title={renewalLabel}
                            >
                              <span>{formatCostExpiry(detail.expiredAt, detail.expiresIn)}</span>
                              <small>{renewalLabel}</small>
                            </span>
                          ) : (
                            formatCostExpiry(detail.expiredAt, detail.expiresIn)
                          )}
                        </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              ) : (
                <div className="assets-card-list">
                {detailRows.map((detail) => {
                  const reminder = renewalByUuid.get(detail.uuid);
                  const renewalTone = reminder
                    ? assetsRenewalTone(reminder.daysRemaining)
                    : undefined;
                  const renewalLabel = reminder
                    ? assetsRenewalLabel(reminder.daysRemaining)
                    : undefined;
                  const priceLabel =
                    detail.note ||
                    `${formatCnyMoney(detail.priceCny)}/${formatBillingCycle(detail.billingCycleDays)}`;
                  return (
                    <div
                      key={detail.uuid}
                      className="cost-summary-detail-item"
                      data-counted={detail.counted}
                      data-renewal-tone={renewalTone}
                      data-node-id={detail.uuid}
                      title={detail.name}
                    >
                      <Link
                        to={`/instance/${encodeURIComponent(detail.uuid)}`}
                        className="cost-summary-detail-name"
                      >
                        <Flag region={detail.region} size={12} />
                        <span className="cost-summary-detail-title">{detail.name}</span>
                      </Link>
                      <strong title="剩余价值">
                        {detail.counted ? formatCnyMoney(detail.remainingCny) : "—"}
                      </strong>
                      <span className="cost-summary-price-chip">{priceLabel}</span>
                      <span className="cost-summary-monthly-chip" title="后台周期价格换算人民币 ÷ 计费月数">
                        <span>月成本</span>{" "}<span>{formatMonthlyCost(detail)}</span>
                      </span>
                      <span
                        className="cost-summary-expire-label"
                        data-tone={renewalTone}
                        title={renewalLabel}
                      >
                        {formatCostExpiry(detail.expiredAt, detail.expiresIn)}
                      </span>
                    </div>
                  );
                })}
                </div>
              )}
            </>
          ) : (
            <div className="cost-summary-empty">
              {rateQuery.isError ? "汇率获取失败，点击右上角刷新重试" : "费用明细加载中"}
            </div>
          )}

          <details className="cost-summary-rate-details">
            <summary>
              <span>汇率</span>
              <strong>
                {exchangeRateRows.length > 0
                  ? exchangeRateRows
                      .slice(0, 3)
                      .map((item) => `${item.code} ${formatCnyMoney(item.value)}`)
                      .join(" · ")
                  : "暂无汇率"}
              </strong>
            </summary>
            {exchangeRateRows.length > 0 ? (
              <div className="cost-summary-rate-list" aria-label="汇率">
                {exchangeRateRows.map((item) => (
                  <div className="cost-summary-rate-item" key={item.code}>
                    <span>1 {item.code}</span>
                    <strong>{formatCnyMoney(item.value)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cost-summary-empty is-compact">暂无可用汇率</div>
            )}
          </details>
        </>
      )}
    </div>
  );
}
