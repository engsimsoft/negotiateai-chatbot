"use client";

import { Library, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { LibrarySourcesValue } from "./source-picker-modal";

export interface SourcePickerTriggerLabel {
  collectionsCount: number;
  documentsCount: number;
}

interface SourcePickerTriggerProps {
  value: LibrarySourcesValue | null;
  onOpen: () => void;
  onClear?: () => void;
}

function formatLabel({
  collectionsCount,
  documentsCount,
}: SourcePickerTriggerLabel): string {
  const parts: string[] = [];
  if (collectionsCount > 0) parts.push(`${collectionsCount} колл.`);
  if (documentsCount > 0) parts.push(`${documentsCount} док.`);
  return parts.join(" + ");
}

export function SourcePickerTrigger({
  value,
  onOpen,
  onClear,
}: SourcePickerTriggerProps) {
  const total =
    (value?.collectionIds.length ?? 0) + (value?.documentIds.length ?? 0);

  if (total === 0) {
    return (
      <Button
        size="sm"
        variant="outline"
        type="button"
        onClick={onOpen}
        className="h-8 gap-1.5 rounded-full border-dashed text-xs font-normal text-muted-foreground"
      >
        <Library className="size-3.5" />
        Источники из Библиотеки
      </Button>
    );
  }

  const label = formatLabel({
    collectionsCount: value!.collectionIds.length,
    documentsCount: value!.documentIds.length,
  });

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        type="button"
        onClick={onOpen}
        className="h-8 gap-1.5 rounded-full border-primary/40 bg-primary/5 text-xs text-foreground hover:bg-primary/10"
      >
        <Library className="size-3.5 text-primary" />
        Источники: {label}
      </Button>
      {onClear && (
        <Button
          size="sm"
          variant="ghost"
          type="button"
          aria-label="Сбросить источники"
          onClick={onClear}
          className="size-7 rounded-full p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
