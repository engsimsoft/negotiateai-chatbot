import { ExternalLink } from "lucide-react";
import type { BriefingArticleSource } from "@/lib/briefing/briefing-types";

const TIER_LABELS: Record<string, string> = {
  flagship: "Флагман",
  respected: "Авторитет",
  niche: "Нишевый",
  community: "Сообщество",
};

interface BriefingSourceCardProps {
  source: BriefingArticleSource;
}

/**
 * ТЗ-А4: Source card for briefing article section.
 * Extracted from BriefingActivePage, added Russian tier labels.
 */
export function BriefingSourceCard({ source }: BriefingSourceCardProps) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2 rounded-lg p-2 transition-colors hover:bg-muted/60"
    >
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground group-hover:underline">
          {source.title}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {source.summary}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          {source.sourceName}
          {source.tier && source.tier !== "unknown" && (
            <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px]">
              {TIER_LABELS[source.tier] || source.tier}
            </span>
          )}
        </p>
      </div>
    </a>
  );
}
