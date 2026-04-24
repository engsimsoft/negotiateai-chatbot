"use client";

import { useEffect, useState } from "react";
import { Folder, Loader2 } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetcher } from "@/lib/utils";

import type { CollectionItem, DocumentItem } from "./types";

interface EditDocumentCollectionsDialogProps {
  document: DocumentItem | null;
  collections: CollectionItem[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

interface DocumentDetailsResponse {
  id: string;
  collectionIds: string[];
}

export function EditDocumentCollectionsDialog({
  document,
  collections,
  onClose,
  onSaved,
}: EditDocumentCollectionsDialogProps) {
  const open = document !== null;

  const { data: details, isLoading } = useSWR<DocumentDetailsResponse>(
    document ? `/api/library/documents/${document.id}` : null,
    fetcher,
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (details?.collectionIds) {
      setSelected(new Set(details.collectionIds));
    } else if (!document) {
      setSelected(new Set());
    }
  }, [details?.collectionIds, document]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!document) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/library/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Не удалось сохранить");
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>В каких коллекциях</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {document && (
            <p className="mb-3 truncate text-sm text-muted-foreground">
              {document.filename}
            </p>
          )}

          {collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              У вас пока нет коллекций. Создайте первую — и сможете раскладывать
              документы.
            </p>
          ) : isLoading ? (
            <div className="flex min-h-28 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {collections.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(c.id)}
                    />
                    {c.emoji ? (
                      <span className="text-base leading-none">{c.emoji}</span>
                    ) : (
                      <Folder className="size-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-foreground">{c.name}</span>
                  </label>
                );
              })}
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || isLoading || collections.length === 0}
          >
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
