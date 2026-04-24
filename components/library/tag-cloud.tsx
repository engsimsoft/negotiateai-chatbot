"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

interface TagCloudProps {
  counts: Map<string, number>;
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
  topLimit?: number;
}

export function TagCloud({
  counts,
  activeTag,
  onSelect,
  topLimit = 12,
}: TagCloudProps) {
  const [expanded, setExpanded] = useState(false);

  const entries = Array.from(counts.entries())
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) return null;

  const visible = expanded ? entries : entries.slice(0, topLimit);
  const hiddenCount = entries.length - visible.length;

  return (
    <section>
      <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Популярные теги
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map(([tag, count]) => {
          const active = activeTag === tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onSelect(active ? null : tag)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors",
                active
                  ? "bg-primary/10 text-primary ring-1 ring-primary/40"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              <span>{tag}</span>
              <span className="text-muted-foreground/70">{count}</span>
            </button>
          );
        })}
        {hiddenCount > 0 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ещё {hiddenCount}
          </button>
        )}
        {expanded && entries.length > topLimit && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            свернуть
          </button>
        )}
      </div>
    </section>
  );
}
