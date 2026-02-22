// ТЗ-Б2: Podcast generation button with topic selection popover

"use client";

import { useState } from "react";
import { Headphones, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { BriefingArticleSection, AudioStatus } from "@/lib/briefing/briefing-types";

type SelectionMode = "all" | "pick";

interface PodcastButtonProps {
  audioStatus: AudioStatus;
  sections: BriefingArticleSection[];
  isGenerating: boolean;
  onGenerate: (topicIds?: string[]) => void;
}

export function PodcastButton({
  audioStatus,
  sections,
  isGenerating,
  onGenerate,
}: PodcastButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(sections.map((s) => s.topicId)),
  );

  // Hide only during active generation (progress screen is shown)
  // Note: when Этап 3 adds mode toggle [Читать|Слушать], it will replace this button for "ready"/"partial"
  if (audioStatus === "generating" || isGenerating) {
    return null;
  }

  // Show "Пересоздать" when podcast already exists (ready/partial/outdated)
  const isRegenerate = audioStatus === "ready" || audioStatus === "partial" || audioStatus === "outdated";

  const handleToggle = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(sections.map((s) => s.topicId)));
  };

  const handleGenerate = () => {
    setOpen(false);
    if (selectionMode === "all") {
      onGenerate();
    } else {
      onGenerate(Array.from(selectedIds));
    }
  };

  const canGenerate = selectionMode === "all" || selectedIds.size > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className="gap-1.5 rounded-lg"
        >
          {isRegenerate ? (
            <Mic className="size-4" />
          ) : (
            <Headphones className="size-4" />
          )}
          <span className="hidden sm:inline">
            {isRegenerate ? "Пересоздать" : "Подкаст"}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-0">
        {/* Header with mode toggle */}
        <div className="border-b px-3 py-2.5">
          <p className="mb-2 text-sm font-medium">Создать подкаст</p>
          <div className="flex gap-1 rounded-lg bg-muted p-0.5">
            <button
              type="button"
              onClick={() => {
                setSelectionMode("all");
                handleSelectAll();
              }}
              className={`flex-1 rounded-md px-3 py-1 text-xs font-medium transition-all duration-150 ${
                selectionMode === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Все темы
            </button>
            <button
              type="button"
              onClick={() => setSelectionMode("pick")}
              className={`flex-1 rounded-md px-3 py-1 text-xs font-medium transition-all duration-150 ${
                selectionMode === "pick"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Выбрать
            </button>
          </div>
        </div>

        {/* Topic checkboxes (visible in "pick" mode) */}
        {selectionMode === "pick" && (
          <div className="max-h-52 overflow-y-auto px-3 py-2">
            <div className="space-y-1">
              {sections.map((section) => (
                <label
                  key={section.topicId}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all duration-150 hover:bg-muted/60"
                >
                  <Checkbox
                    checked={selectedIds.has(section.topicId)}
                    onCheckedChange={(checked) =>
                      handleToggle(section.topicId, checked === true)
                    }
                  />
                  <span className="text-sm">
                    {section.emoji} {section.topicName}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Generate button */}
        <div className="border-t px-3 py-2.5">
          <Button
            variant="default"
            size="sm"
            className="w-full gap-1.5"
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            <Mic className="size-3.5" />
            {isRegenerate ? "Пересоздать" : "Создать"}
            {selectionMode === "pick" && selectedIds.size > 0 && (
              <span className="text-primary-foreground/70">
                ({selectedIds.size})
              </span>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
