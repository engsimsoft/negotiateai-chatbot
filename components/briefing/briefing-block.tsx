import type { BriefingItem as BriefingItemType } from "@/lib/briefing/briefing-types";
import { BriefingItem } from "./briefing-item";

interface BriefingBlockProps {
  emoji: string;
  topicName: string;
  items: BriefingItemType[];
  isHighlight?: boolean;
}

export function BriefingBlock({
  emoji,
  topicName,
  items,
  isHighlight,
}: BriefingBlockProps) {
  if (items.length === 0) return null;

  return (
    <div
      className={`rounded-xl border p-5 ${
        isHighlight ? "bg-primary/5" : "bg-background"
      }`}
    >
      <h3
        className={`mb-3 flex items-center gap-2 font-semibold ${
          isHighlight ? "text-lg" : "text-base"
        }`}
      >
        <span>{emoji}</span>
        <span>{topicName}</span>
      </h3>
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <BriefingItem key={`${item.sourceUrl}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
