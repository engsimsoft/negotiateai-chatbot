// ТЗ-Б2 Этап 3+5: Segmented toggle [Читать | Слушать]
// Visible when audioStatus is ready/partial. Terracotta active state.
// Этап 5: Outdated indicator (warning dot)

"use client";

import { BookOpen, Headphones } from "lucide-react";

export type BriefingViewMode = "read" | "listen";

interface BriefingModeToggleProps {
  mode: BriefingViewMode;
  onChange: (mode: BriefingViewMode) => void;
  /** ТЗ-Б2 Этап 5: Show warning indicator when podcast is outdated */
  isOutdated?: boolean;
}

export function BriefingModeToggle({ mode, onChange, isOutdated }: BriefingModeToggleProps) {
  return (
    <div className="flex gap-0.5 rounded-[22px] bg-muted p-0.75">
      <button
        type="button"
        onClick={() => onChange("read")}
        className={`flex items-center gap-1.5 rounded-[20px] px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
          mode === "read"
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <BookOpen className="size-3.5" />
        <span className="hidden sm:inline">Читать</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("listen")}
        className={`relative flex items-center gap-1.5 rounded-[20px] px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
          mode === "listen"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Headphones className="size-3.5" />
        <span className="hidden sm:inline">Слушать</span>
        {isOutdated && (
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warning" />
        )}
      </button>
    </div>
  );
}
