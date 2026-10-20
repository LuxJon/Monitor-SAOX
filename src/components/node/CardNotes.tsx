import { joinTagTitle } from "./nodeCardShared";

export function CardNotes({ tags }: { tags: Array<{ label: string; color: string }> }) {
  if (tags.length === 0) return null;
  return <div className="dstatus-tags-row" aria-label="节点标签" title={joinTagTitle(tags)}>
    {tags.map((tag, index) => <span key={tag.label + index} className="dstatus-tag-chip" data-tag={tag.color} title={tag.label}
      style={{ background: "var(--tag-bg)", color: "var(--tag-fg)" }}>{tag.label}</span>)}
  </div>;
}
