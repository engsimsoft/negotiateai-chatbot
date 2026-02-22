// ТЗ-Б2 Этап 3: Segmented toggle [📖 Читать | 🎧 Слушать]
// Visible when audioStatus is ready/partial. Terracotta active state.

"use client";

import { BookOpen, Headphones } from "lucide-react";

export type BriefingViewMode = "read" | "listen";

interface BriefingModeToggleProps {
  mode: BriefingViewMode;
  onChange: (mode: BriefingViewMode) => void;
}

export function BriefingModeToggle({ mode, onChange }: BriefingModeToggleProps) {
  return (
    <div className="flex gap-0.5 rounded-[22px] bg-muted p-[3px]">
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
        className={`flex items-center gap-1.5 rounded-[20px] px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
          mode === "listen"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Headphones className="size-3.5" />
        <span className="hidden sm:inline">Слушать</span>
      </button>
    </div>
  );
}
