"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { CollectionItem } from "./types";

interface RenameCollectionDialogProps {
  collection: CollectionItem | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function RenameCollectionDialog({
  collection,
  onClose,
  onSaved,
}: RenameCollectionDialogProps) {
  const open = collection !== null;
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setEmoji(collection.emoji ?? "");
      setError(null);
    }
  }, [collection]);

  const handleSubmit = async () => {
    if (!collection) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Введите название");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/library/collections/${collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          emoji: emoji.trim() || null,
        }),
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
          <DialogTitle>Переименовать коллекцию</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rename-name">Название</Label>
            <Input
              id="rename-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) handleSubmit();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rename-emoji">Эмодзи (необязательно)</Label>
            <Input
              id="rename-emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="📁"
              maxLength={4}
              className="w-24"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
