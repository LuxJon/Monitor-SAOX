import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { NodeInfo } from "@/types/komari";
import { getExpiryWarningDays } from "@/services/api";
import { getExpiringNodes } from "@/utils/expiryFilter";
import { useAuth } from "@/hooks/useAuth";
import { useMinuteClock } from "@/hooks/useClock";

export function useExpiryFilter(nodes: NodeInfo[]) {
  const { data: me } = useAuth();
  const loggedIn = me?.logged_in === true;
  const now = useMinuteClock();
  const query = useQuery({
    queryKey: ["expiry-warning-days", loggedIn],
    queryFn: ({ signal }) => getExpiryWarningDays({ signal }),
    enabled: loggedIn,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  const days = loggedIn && !query.isError ? query.data ?? null : null;
  const expiringNodes = useMemo(() => getExpiringNodes(nodes, days, now), [nodes, days, now]);
  const message = !loggedIn ? "登录后可按后台提醒天数查看即将到期的服务器"
    : query.isError ? "无法读取后台到期提醒设置，请重试或重新登录"
    : days == null ? "正在读取后台到期提醒设置…"
    : days === 0 ? "后台已关闭到期提醒（0 天）"
    : `按后台设置：${days} 天内到期 · ${expiringNodes.length} 台`;
  return { days, expiringNodes, message, loggedIn, retry: query.refetch, isError: query.isError };
}
