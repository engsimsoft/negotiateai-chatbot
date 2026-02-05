"use client";

import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";

interface ChatHistoryCardProps {
  count: number;
}

export function ChatHistoryCard({ count }: ChatHistoryCardProps) {
  const label = count === 1 ? "чат" : count >= 2 && count <= 4 ? "чата" : "чатов";

  return (
    <Link
      href="/chats"
      className="group flex shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-background px-4 py-3.5 shadow-sm transition-all hover:border-primary hover:shadow-md"
      style={{ minWidth: 160 }}
    >
      <span className="text-xl">💬</span>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">
          История чатов
        </span>
        <span className="text-xs text-muted-foreground">
          {count} {label}
        </span>
      </div>
      <ArrowRight className="ml-1 size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
    </Link>
  );
}
