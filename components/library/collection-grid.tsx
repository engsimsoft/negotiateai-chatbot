"use client";

import { Folder, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { CollectionItem } from "./types";

interface CollectionGridProps {
  collections: CollectionItem[];
  activeCollectionId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
  onRename: (collection: CollectionItem) => void;
  onDelete: (collection: CollectionItem) => void;
}

export function CollectionGrid({
  collections,
  activeCollectionId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: CollectionGridProps) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Мои коллекции
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="size-3" />
          <span>новая</span>
        </button>
      </div>

      {collections.length === 0 ? (
        <button
          type="button"
          onClick={onCreate}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background p-6 text-sm text-muted-foreground transition-all hover:border-primary hover:text-foreground"
        >
          <Plus className="size-4" />
          Создать первую коллекцию
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => {
            const isActive = activeCollectionId === c.id;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(isActive ? null : c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(isActive ? null : c.id);
                  }
                }}
                className={cn(
                  "group relative flex cursor-pointer flex-col items-start gap-1.5 rounded-xl border bg-background p-3 text-left transition-all hover:border-primary hover:shadow-sm",
                  isActive && "border-primary bg-primary/5 shadow-sm",
                )}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {c.emoji ? (
                      <span className="text-base leading-none">{c.emoji}</span>
                    ) : (
                      <Folder className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate text-sm font-medium text-foreground">
                      {c.name}
                    </span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100"
                        aria-label="Действия с коллекцией"
                      >
                        <MoreVertical className="size-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem onSelect={() => onRename(c)}>
                        <Pencil className="mr-2 size-4" />
                        Переименовать
                      </DropdownMenuItem>
                      {!c.isDefault && (
                        <DropdownMenuItem
                          onSelect={() => onDelete(c)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" />
                          Удалить
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDocumentCount(c.documentCount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatDocumentCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (count === 0) return "пусто";
  if (mod100 >= 11 && mod100 <= 19) return `${count} документов`;
  if (mod10 === 1) return `${count} документ`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} документа`;
  return `${count} документов`;
}
