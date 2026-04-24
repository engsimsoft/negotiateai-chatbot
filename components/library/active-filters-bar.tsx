"use client";

import { X } from "lucide-react";

import type { CollectionItem } from "./types";
import type { LibraryFilters } from "./filters";
import { labelForAutoType } from "./filters";

interface ActiveFiltersBarProps {
  filters: LibraryFilters;
  collections: CollectionItem[];
  onChange: (next: Partial<LibraryFilters>) => void;
  onReset: () => void;
}

export function ActiveFiltersBar({
  filters,
  collections,
  onChange,
  onReset,
}: ActiveFiltersBarProps) {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (filters.collectionId) {
    const name =
      collections.find((c) => c.id === filters.collectionId)?.name ??
      "Коллекция";
    chips.push({
      key: "collection",
      label: name,
      onRemove: () => onChange({ collectionId: null }),
    });
  }
  if (filters.autoType) {
    chips.push({
      key: "autoType",
      label: labelForAutoType(filters.autoType),
      onRemove: () => onChange({ autoType: null }),
    });
  }
  if (filters.tag) {
    chips.push({
      key: "tag",
      label: `#${filters.tag}`,
      onRemove: () => onChange({ tag: null }),
    });
  }
  if (filters.search.trim()) {
    chips.push({
      key: "search",
      label: `«${filters.search.trim()}»`,
      onRemove: () => onChange({ search: "" }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Фильтры:</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="group inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-primary/15"
        >
          <span>{chip.label}</span>
          <X className="size-3 text-muted-foreground group-hover:text-foreground" />
        </button>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="ml-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        Сбросить
      </button>
    </div>
  );
}
