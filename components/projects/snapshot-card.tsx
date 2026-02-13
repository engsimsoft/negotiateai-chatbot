"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Data structure returned by createSnapshot tool output
 */
export interface SnapshotData {
  status: string;
  shortSummary: string;
  fullMarkdown: string;
  message: string;
}

/**
 * Parse fullMarkdown into sections for structured display.
 * fullMarkdown format:
 *   ## Итог\n...\n\n## Ключевые решения\n- ...\n\n## Текущее состояние\n...
 */
function parseSections(fullMarkdown: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const parts = fullMarkdown.split(/^## /m).filter(Boolean);

  for (const part of parts) {
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) continue;
    const title = part.substring(0, newlineIdx).trim();
    const content = part.substring(newlineIdx + 1).trim();
    if (content) {
      sections.push({ title, content });
    }
  }

  return sections;
}

interface SnapshotCardProps {
  data: SnapshotData;
}

export function SnapshotCard({ data }: SnapshotCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sections = parseSections(data.fullMarkdown);

  // Skip "Итог" section in expanded view (it's already shown as shortSummary)
  const detailSections = sections.filter((s) => s.title !== "Итог");

  return (
    <div className="my-2 rounded-lg bg-muted px-4 py-3">
      {/* Collapsed: always visible */}
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Итог зафиксирован</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data.shortSummary}
          </p>
        </div>
      </div>

      {/* Toggle button */}
      {detailSections.length > 0 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="size-3" />
              Свернуть
            </>
          ) : (
            <>
              <ChevronDown className="size-3" />
              Подробнее
            </>
          )}
        </button>
      )}

      {/* Expanded: detail sections */}
      {isExpanded && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {detailSections.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-medium text-muted-foreground">
                {section.title}
              </p>
              <div className="mt-1 text-sm whitespace-pre-line">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Thin divider shown after snapshot card or for fallback snapshots
 */
export function SnapshotDivider({ label = "Контекст обновлён" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-px flex-1 bg-border" />
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="size-3" />
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
