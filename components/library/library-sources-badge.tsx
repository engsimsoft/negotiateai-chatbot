"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, FileText, Library } from "lucide-react";

import { cn } from "@/lib/utils";

export interface LibrarySourceCitation {
  /** xAI file_id (всегда есть) */
  fileId: string;
  /** Наш UUID. Если undefined — документ не найден в БД, ссылку не делаем. */
  documentId?: string;
  filename?: string;
  pageNumber?: number;
  /** Лучший score чанка для этого документа (для сортировки). */
  topScore?: number;
}

interface LibrarySourcesBadgeProps {
  citations: LibrarySourceCitation[];
}

function formatSourcesCount(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${n} источников`;
  if (mod10 === 1) return `${n} источник`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} источника`;
  return `${n} источников`;
}

export function LibrarySourcesBadge({ citations }: LibrarySourcesBadgeProps) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;

  return (
    <div className="my-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted"
        aria-expanded={open}
      >
        <Library className="size-3.5 text-muted-foreground" />
        <span>Из Библиотеки · {formatSourcesCount(citations.length)}</span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul className="mt-2 space-y-1 rounded-lg border border-border bg-background p-2 text-sm">
          {citations.map((c) => {
            const label = c.filename ?? c.fileId;
            const pageSuffix =
              typeof c.pageNumber === "number" && c.pageNumber > 0
                ? ` · стр. ${c.pageNumber}`
                : "";
            const inner = (
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {label}
                  <span className="text-muted-foreground">{pageSuffix}</span>
                </span>
              </span>
            );
            return (
              <li
                key={`${c.fileId}-${c.pageNumber ?? 0}`}
                className="rounded-md px-2 py-1.5 hover:bg-muted/60"
              >
                {c.documentId ? (
                  <Link href={`/library/${c.documentId}`} className="block">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
