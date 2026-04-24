"use client";

import { Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { labelForAutoType } from "./filters";
import type { DocumentItem } from "./types";

interface DocumentRowProps {
  document: DocumentItem;
  onOpen?: (document: DocumentItem) => void;
  onEditCollections?: (document: DocumentItem) => void;
  onDelete?: (document: DocumentItem) => void;
}

export function DocumentRow({
  document,
  onOpen,
  onEditCollections,
  onDelete,
}: DocumentRowProps) {
  const ext = getFileExtension(document.filename, document.mimeType);
  const sizeLabel = formatFileSize(document.size);
  const dateLabel = formatDate(document.createdAt);
  const typeLabel = document.autoType ? labelForAutoType(document.autoType) : null;
  const tags = document.autoTags ?? [];
  const visibleTags = tags.slice(0, 3);
  const extraTags = tags.length - visibleTags.length;

  const handleRootClick = () => onOpen?.(document);
  const handleRootKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen?.(document);
    }
  };

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : -1}
      onClick={onOpen ? handleRootClick : undefined}
      onKeyDown={onOpen ? handleRootKeyDown : undefined}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border bg-background p-3 text-left transition-all",
        onOpen && "cursor-pointer hover:border-primary hover:shadow-sm",
      )}
    >
      <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
        {ext}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {document.filename}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {[typeLabel, sizeLabel, dateLabel].filter(Boolean).join(" · ")}
        </p>
        {visibleTags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
            {extraTags > 0 && (
              <span className="text-[11px] text-muted-foreground/70">
                +{extraTags}
              </span>
            )}
          </div>
        )}
      </div>

      <StatusBadge status={document.status} statusError={document.statusError} />

      {(onEditCollections || onDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100"
              aria-label="Действия с документом"
            >
              <MoreVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {onEditCollections && (
              <DropdownMenuItem
                onSelect={() => onEditCollections(document)}
              >
                <Pencil className="mr-2 size-4" />
                В коллекциях…
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onSelect={() => onDelete(document)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Удалить
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  statusError,
}: {
  status: DocumentItem["status"];
  statusError: string | null;
}) {
  if (status === "ready") {
    return <span className="shrink-0 text-xs text-success">готов</span>;
  }
  if (status === "error") {
    return (
      <span
        className="shrink-0 text-xs text-destructive"
        title={statusError ?? undefined}
      >
        ошибка
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-xs",
        status === "uploading" ? "text-muted-foreground" : "text-warning",
      )}
    >
      <Loader2 className="size-3 animate-spin" />
      {status === "uploading" ? "загрузка" : "обработка"}
    </span>
  );
}

function getFileExtension(filename: string, mimeType: string): string {
  const byName = filename.split(".").pop()?.toLowerCase();
  if (byName && byName.length <= 5) return byName.toUpperCase();
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "XLS";
  if (mimeType.includes("wordprocessing")) return "DOC";
  if (mimeType.includes("presentation")) return "PPT";
  if (mimeType.startsWith("image/")) return "IMG";
  if (mimeType.startsWith("text/")) return "TXT";
  return "FILE";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} МБ` : `${mb.toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}
