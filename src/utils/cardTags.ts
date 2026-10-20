import { parseTags } from "./format";

const COLORS = ["blue", "violet", "teal", "amber", "pink", "cyan"];

/** Public remarks and tags share the same semicolon-separated chip format. */
export function buildCardTags(remark?: string | null, tags?: string | null, group?: string) {
  const seen = new Set<string>();
  const result: Array<{ label: string; color: string }> = [];
  for (const raw of [remark, tags, group]) {
    for (const part of (raw ?? "").split(/[;；,，]/)) {
      const tag = parseTags(part)[0];
      if (!tag || seen.has(tag.label.toLowerCase())) continue;
      seen.add(tag.label.toLowerCase());
      // Explicit colors win; otherwise keep adjacent notes visually distinct.
      const explicit = /<([a-zA-Z]+)>$/.test(part.trim());
      result.push({ ...tag, color: explicit ? tag.color : COLORS[result.length % COLORS.length]! });
    }
  }
  return result;
}
