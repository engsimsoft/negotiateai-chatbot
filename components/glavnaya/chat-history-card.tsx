"use client";

import Link from "next/link";
import { ArrowRight, Brain } from "lucide-react";

/**
 * ТЗ-KITT: "Мой контекст" card — replaces "История чатов"
 * Shows MIND memory stats, links to /context dashboard
 */

interface ContextCardProps {
  factCount: number;
}

export function ContextCard({ factCount }: ContextCardProps) {
  const label =
    factCount === 0
      ? "Пусто"
      : factCount === 1
        ? "1 факт"
        : factCount >= 2 && factCount <= 4
          ? `${factCount} факта`
          : `${factCount} фактов`;

  return (
    <Link
      href="/context"
      className="group flex shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-background px-4 py-3.5 shadow-sm transition-all hover:border-primary hover:shadow-md"
      style={{ minWidth: 160 }}
    >
      <Brain className="size-5 text-primary" />
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">
          Мой контекст
        </span>
        <span className="text-xs text-muted-foreground">
          {label}
        </span>
      </div>
      <ArrowRight className="ml-1 size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
    </Link>
  );
}
