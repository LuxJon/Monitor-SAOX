import type { NodeInfo } from "@/types/komari";
import { getExpireDaysRemaining } from "@/utils/format";

// Monitor accepts integer reminder windows from 0 (disabled) to 365 days.
export function parseExpiryWarningDays(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) return null;
  const days = Number(value);
  return Number.isInteger(days) && days >= 0 && days <= 365 ? days : null;
}

export function getExpiringNodes<T extends Pick<NodeInfo, "uuid" | "expired_at" | "expires_in">>(
  nodes: T[], days: number | null, now = Date.now(),
): T[] {
  if (days == null || parseExpiryWarningDays(days) == null || days === 0) return [];
  return nodes.map(node => ({ node, remaining: getExpireDaysRemaining(node.expired_at, now, node.expires_in) }))
    .filter((item): item is { node: T; remaining: number } => item.remaining != null && item.remaining >= 0 && item.remaining <= days)
    .sort((a, b) => a.remaining - b.remaining || a.node.uuid.localeCompare(b.node.uuid))
    .map(item => item.node);
}
