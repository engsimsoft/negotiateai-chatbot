"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { CollectionItem } from "./types";

interface DeleteCollectionDialogProps {
  collection: CollectionItem | null;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}

export function DeleteCollectionDialog({
  collection,
  onClose,
  onDeleted,
}: DeleteCollectionDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!collection) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/library/collections/${collection.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Не удалось удалить");
      }
      toast.success(`Коллекция «${collection.name}» удалена`);
      await onDeleted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={collection !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить коллекцию?</AlertDialogTitle>
          <AlertDialogDescription>
            Коллекция{" "}
            <span className="font-medium text-foreground">
              «{collection?.name}»
            </span>{" "}
            будет удалена. Документы внутри останутся в Библиотеке — они не
            удаляются вместе с коллекцией.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={submitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
