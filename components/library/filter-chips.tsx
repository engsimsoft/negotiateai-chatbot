"use client";

import { cn } from "@/lib/utils";

import { labelForAutoType } from "./filters";

interface FilterChipsProps {
  counts: Map<string, number>;
  totalCount: number;
  activeValue: string | null;
  onSelect: (value: string | null) => void;
}

export function FilterChips({
  counts,
  totalCount,
  activeValue,
  onSelect,
}: FilterChipsProps) {
  const entries = Array.from(counts.entries())
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0 && totalCount === 0) return null;

  return (
    <section>
      <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        По типу
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Chip
          label="Все"
          count={totalCount}
          active={activeValue === null}
          onClick={() => onSelect(null)}
        />
        {entries.map(([value, count]) => (
          <Chip
            key={value}
            label={labelForAutoType(value)}
            count={count}
            active={activeValue === value}
            onClick={() => onSelect(activeValue === value ? null : value)}
          />
        ))}
      </div>
    </section>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs transition-all",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <span className="text-muted-foreground/70">{count}</span>
    </button>
  );
}
