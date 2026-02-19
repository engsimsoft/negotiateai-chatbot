import type {
  BriefingItem as BriefingItemType,
  BriefingJSON,
} from "@/lib/briefing/briefing-types";
import { BriefingBlock } from "./briefing-block";

interface BriefingContentProps {
  briefing: BriefingJSON;
}

export function BriefingContent({ briefing }: BriefingContentProps) {
  // 1. Merge blocks with same topicId
  const mergedMap = new Map<
    string,
    { topicName: string; emoji: string; items: BriefingItemType[] }
  >();

  for (const block of briefing.blocks) {
    const existing = mergedMap.get(block.topicId);
    if (existing) {
      existing.items.push(...block.items);
    } else {
      mergedMap.set(block.topicId, {
        topicName: block.topicName,
        emoji: block.emoji,
        items: [...block.items],
      });
    }
  }

  // 2. Check if analyst sent a "top" block (ТЗ-BR3)
  const topBlock = mergedMap.get("top");
  const hasTopBlock = topBlock !== undefined && topBlock.items.length > 0;

  // 3. Build highlight and topic blocks
  let highlightItems: BriefingItemType[] = [];
  const topicBlocks: {
    topicId: string;
    topicName: string;
    emoji: string;
    items: BriefingItemType[];
  }[] = [];

  if (hasTopBlock) {
    // New path: analyst explicitly grouped "Главное" into topicId "top"
    highlightItems = topBlock.items;

    for (const [topicId, data] of mergedMap) {
      if (topicId === "top") continue;
      topicBlocks.push({ topicId, ...data });
    }
  } else {
    // Fallback: old briefings without "top" — extract high-importance items
    for (const [topicId, data] of mergedMap) {
      const high = data.items.filter((item) => item.importance === "high");
      const rest = data.items.filter((item) => item.importance !== "high");

      highlightItems.push(...high);

      if (rest.length > 0) {
        topicBlocks.push({ topicId, ...data, items: rest });
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* "Главное" block */}
      {highlightItems.length > 0 && (
        <BriefingBlock
          emoji={hasTopBlock ? topBlock.emoji : "⚡"}
          topicName="Главное"
          items={highlightItems}
          isHighlight
        />
      )}

      {/* Topic blocks */}
      {topicBlocks.map((block) => (
        <BriefingBlock
          key={block.topicId}
          emoji={block.emoji}
          topicName={block.topicName}
          items={block.items}
        />
      ))}
    </div>
  );
}
