"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Folder, Loader2, Search, X } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/utils";

import type { CollectionItem, DocumentItem } from "./types";

export const SOURCE_PICKER_MAX_COLLECTIONS = 3;
export const SOURCE_PICKER_MAX_DOCUMENTS = 5;

export interface LibrarySourcesValue {
  collectionIds: string[];
  documentIds: string[];
}

interface SourcePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: LibrarySourcesValue;
  onSelect: (value: LibrarySourcesValue) => void;
}

interface CollectionsResponse {
  collections: CollectionItem[];
}

interface DocumentsResponse {
  documents: DocumentItem[];
}

export function SourcePickerModal({
  open,
  onOpenChange,
  initialValue,
  onSelect,
}: SourcePickerModalProps) {
  const { data: collectionsData, isLoading: collectionsLoading } =
    useSWR<CollectionsResponse>(
      open ? "/api/library/collections" : null,
      fetcher,
    );
  const { data: documentsData, isLoading: documentsLoading } =
    useSWR<DocumentsResponse>(
      open ? "/api/library/documents?limit=200" : null,
      fetcher,
    );

  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(
    new Set(),
  );
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(
    new Set(),
  );
  const [docSearch, setDocSearch] = useState("");

  // Сброс выделения при каждом открытии — initialValue выступает «начальным»,
  // а не «постоянным» состоянием (модалка переоткрывается под новый scope).
  useEffect(() => {
    if (open) {
      setSelectedCollections(new Set(initialValue?.collectionIds ?? []));
      setSelectedDocuments(new Set(initialValue?.documentIds ?? []));
      setDocSearch("");
    }
  }, [open, initialValue]);

  const collections = collectionsData?.collections ?? [];
  const readyDocuments = useMemo(
    () =>
      (documentsData?.documents ?? []).filter((d) => d.status === "ready"),
    [documentsData],
  );
  const filteredDocuments = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return readyDocuments;
    return readyDocuments.filter((d) =>
      d.filename.toLowerCase().includes(q),
    );
  }, [readyDocuments, docSearch]);

  const collectionsLimit = SOURCE_PICKER_MAX_COLLECTIONS;
  const documentsLimit = SOURCE_PICKER_MAX_DOCUMENTS;
  const collectionsAtLimit =
    selectedCollections.size >= collectionsLimit;
  const documentsAtLimit = selectedDocuments.size >= documentsLimit;

  const toggleCollection = (id: string) => {
    setSelectedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < collectionsLimit) {
        next.add(id);
      }
      return next;
    });
  };

  const toggleDocument = (id: string) => {
    setSelectedDocuments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < documentsLimit) {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onSelect({
      collectionIds: Array.from(selectedCollections),
      documentIds: Array.from(selectedDocuments),
    });
    onOpenChange(false);
  };

  const handleClear = () => {
    onSelect({ collectionIds: [], documentIds: [] });
    onOpenChange(false);
  };

  const totalSelected =
    selectedCollections.size + selectedDocuments.size;
  const isLoading = collectionsLoading || documentsLoading;
  const isEmptyLibrary =
    !isLoading && collections.length === 0 && readyDocuments.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Источники из Библиотеки</DialogTitle>
          <DialogDescription>
            Выберите до {collectionsLimit} коллекций и до {documentsLimit}{" "}
            документов. Модель будет искать ответы только в них.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : isEmptyLibrary ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            В Библиотеке пока нет готовых документов. Загрузите файлы на странице
            «Библиотека» — они появятся здесь.
          </p>
        ) : (
          <div className="grid gap-5 py-1 sm:grid-cols-2">
            <section className="flex min-h-0 flex-col">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  Коллекции
                </h3>
                <span className="text-xs text-muted-foreground">
                  {selectedCollections.size}/{collectionsLimit}
                </span>
              </div>
              {collections.length === 0 ? (
                <p className="text-xs text-muted-foreground">Нет коллекций.</p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  {collections.map((c) => {
                    const checked = selectedCollections.has(c.id);
                    const disabled = !checked && collectionsAtLimit;
                    return (
                      <label
                        key={c.id}
                        className={
                          "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60" +
                          (disabled ? " cursor-not-allowed opacity-50" : "")
                        }
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={() => toggleCollection(c.id)}
                        />
                        {c.emoji ? (
                          <span className="text-base leading-none">{c.emoji}</span>
                        ) : (
                          <Folder className="size-4 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate text-sm text-foreground">
                          {c.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {c.documentCount}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="flex min-h-0 flex-col">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  Документы
                </h3>
                <span className="text-xs text-muted-foreground">
                  {selectedDocuments.size}/{documentsLimit}
                </span>
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-sm"
                  placeholder="Поиск по имени"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                />
              </div>
              {readyDocuments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Нет готовых документов.
                </p>
              ) : filteredDocuments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Ничего не найдено.
                </p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  {filteredDocuments.map((d) => {
                    const checked = selectedDocuments.has(d.id);
                    const disabled = !checked && documentsAtLimit;
                    return (
                      <label
                        key={d.id}
                        className={
                          "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60" +
                          (disabled ? " cursor-not-allowed opacity-50" : "")
                        }
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={() => toggleDocument(d.id)}
                        />
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate text-sm text-foreground">
                          {d.filename}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleClear}
            disabled={totalSelected === 0 && !initialValue}
          >
            <X className="mr-1 size-4" />
            Сбросить
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isEmptyLibrary || totalSelected === 0}
            >
              Применить
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
