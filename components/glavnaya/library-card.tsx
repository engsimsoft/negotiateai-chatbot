"use client";

import Link from "next/link";
import { ArrowRight, Library } from "lucide-react";

interface LibraryCardProps {
  documentCount: number;
  collectionCount: number;
}

export function LibraryCard({
  documentCount,
  collectionCount,
}: LibraryCardProps) {
  const label =
    documentCount === 0
      ? "Пусто"
      : `${formatDocs(documentCount)}${
          collectionCount > 0
            ? ` · ${formatCollections(collectionCount)}`
            : ""
        }`;

  return (
    <Link
      href="/library"
      className="group flex shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-background px-4 py-3.5 shadow-sm transition-all hover:border-primary hover:shadow-md"
    >
      <Library className="size-5 text-primary" />
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">
          Библиотека
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <ArrowRight className="ml-1 size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
    </Link>
  );
}

function formatDocs(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${count} документов`;
  if (mod10 === 1) return `${count} документ`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} документа`;
  return `${count} документов`;
}

function formatCollections(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${count} коллекций`;
  if (mod10 === 1) return `${count} коллекция`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} коллекции`;
  return `${count} коллекций`;
}
