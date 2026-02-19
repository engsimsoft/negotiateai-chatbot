import type {
  BriefingBlock as BriefingBlockType,
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

  // 2. Extract high-importance items into "Главное"
  const highItems: BriefingItemType[] = [];
  const topicBlocks: {
    topicId: string;
    topicName: string;
    emoji: string;
    items: BriefingItemType[];
  }[] = [];

  for (const [topicId, data] of mergedMap) {
    const high = data.items.filter((item) => item.importance === "high");
    const rest = data.items.filter((item) => item.importance !== "high");

    highItems.push(...high);

    if (rest.length > 0) {
      topicBlocks.push({ topicId, ...data, items: rest });
    }
  }

  return (
    <div className="space-y-4">
      {/* "Главное" block — only if there are high items */}
      {highItems.length > 0 && (
        <BriefingBlock
          emoji="⚡"
          topicName="Главное"
          items={highItems}
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
