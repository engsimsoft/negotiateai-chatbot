"use client";

import {
  MessageSquare,
  Users,
  Hash,
  Power,
  PowerOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { GroupClient } from "./groups-page";

interface GroupListProps {
  groups: GroupClient[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onDeactivate: (groupId: string) => void;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function GroupList({
  groups,
  selectedGroupId,
  onSelectGroup,
  onDeactivate,
}: GroupListProps) {
  // Sort: active first, then by last message date
  const sorted = [...groups].sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    const aDate = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bDate = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bDate - aDate;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {sorted.map((group) => (
          <div
            key={group.id}
            role="button"
            tabIndex={0}
            className={cn(
              "flex cursor-pointer flex-col gap-1 border-b px-4 py-3 transition-colors hover:bg-muted/60",
              group.id === selectedGroupId && "bg-muted",
              !group.isActive && "opacity-60",
            )}
            onClick={() => onSelectGroup(group.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelectGroup(group.id);
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">
                  {group.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {group.isForum && (
                  <span className="flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    <Hash className="size-3" />
                    Форум
                  </span>
                )}
                {group.isActive ? (
                  <Power className="size-3.5 text-green-500" />
                ) : (
                  <PowerOff className="size-3.5 text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MessageSquare className="size-3" />
                {group.messageCount}
              </span>
              <span>{formatDate(group.lastMessageAt)}</span>
            </div>

            {group.isActive && (
              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeactivate(group.id);
                  }}
                >
                  Отключить
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
