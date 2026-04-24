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

import type { DocumentItem } from "./types";

interface DeleteDocumentDialogProps {
  document: DocumentItem | null;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}

export function DeleteDocumentDialog({
  document,
  onClose,
  onDeleted,
}: DeleteDocumentDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!document) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/library/documents/${document.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Не удалось удалить");
      }
      toast.success(`${document.filename} удалён`);
      await onDeleted();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Ошибка удаления",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={document !== null} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">
              {document?.filename}
            </span>{" "}
            будет удалён из Библиотеки безвозвратно. Simply перестанет
            ссылаться на него в ответах.
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
