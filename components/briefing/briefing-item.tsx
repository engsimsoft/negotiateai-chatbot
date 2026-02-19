import { ExternalLink } from "lucide-react";
import type { BriefingItem as BriefingItemType } from "@/lib/briefing/briefing-types";

interface BriefingItemProps {
  item: BriefingItemType;
}

export function BriefingItem({ item }: BriefingItemProps) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group/link inline-flex items-start gap-1 font-medium text-primary hover:underline"
      >
        <span>{item.title}</span>
        <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
      </a>
      <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground/70">
        <span>{item.sourceName}</span>
        {item.sourceLanguage !== "ru" && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
            {item.sourceLanguage.toUpperCase()}→RU
          </span>
        )}
        {item.publishedAt && (
          <span>{formatRelativeTime(item.publishedAt)}</span>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffHour < 24) return `${diffHour} ч назад`;
  if (diffDay === 1) return "вчера";
  if (diffDay < 7) return `${diffDay} дн назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
