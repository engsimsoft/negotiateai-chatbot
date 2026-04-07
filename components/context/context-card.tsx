"use client";

import type { LucideIcon } from "lucide-react";

interface ContextCardProps {
  icon: LucideIcon;
  label: string;
  count: number;
  preview: string[];
  color: string; // tailwind text color class, e.g. "text-amber-500"
  onClick?: () => void;
}

export function ContextCard({
  icon: Icon,
  label,
  count,
  preview,
  color,
  onClick,
}: ContextCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col gap-2 rounded-xl border bg-background p-4 text-left transition-all hover:border-primary hover:shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <Icon className={`size-5 ${color}`} />
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </div>
      {preview.length > 0 && (
        <div className="flex flex-col gap-1">
          {preview.map((fact) => (
            <p
              key={fact}
              className="line-clamp-1 text-xs text-muted-foreground"
            >
              {fact}
            </p>
          ))}
        </div>
      )}
    </button>
  );
}
