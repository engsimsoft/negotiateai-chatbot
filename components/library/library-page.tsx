"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Library as LibraryIcon, Loader2 } from "lucide-react";
import useSWR from "swr";

import { fetcher } from "@/lib/utils";

import { ActiveFiltersBar } from "./active-filters-bar";
import { CollectionGrid } from "./collection-grid";
import { CreateCollectionDialog } from "./create-collection-dialog";
import { DeleteCollectionDialog } from "./delete-collection-dialog";
import { DeleteDocumentDialog } from "./delete-document-dialog";
import { DocumentRow } from "./document-row";
import { EditDocumentCollectionsDialog } from "./edit-document-collections-dialog";
import { RenameCollectionDialog } from "./rename-collection-dialog";
import { FilterChips } from "./filter-chips";
import { SearchBar } from "./search-bar";
import { TagCloud } from "./tag-cloud";
import { UploadButton } from "./upload-button";
import {
  EMPTY_FILTERS,
  applyClientFilters,
  countBy,
  type LibraryFilters,
} from "./filters";
import type { CollectionItem, DocumentItem } from "./types";

interface CollectionsResponse {
  collections: CollectionItem[];
}

interface DocumentsResponse {
  documents: DocumentItem[];
  total: number;
  limit: number;
  offset: number;
}

export function LibraryPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentItem | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentItem | null>(null);
  const [renameColl, setRenameColl] = useState<CollectionItem | null>(null);
  const [deleteColl, setDeleteColl] = useState<CollectionItem | null>(null);

  const openDocument = (doc: DocumentItem) => {
    if (doc.status !== "ready") return;
    router.push(`/library/${doc.id}`);
  };

  const patchFilters = (patch: Partial<LibraryFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const {
    data: collectionsData,
    isLoading: collectionsLoading,
    mutate: mutateCollections,
  } = useSWR<CollectionsResponse>("/api/library/collections", fetcher);

  const documentsKey = filters.collectionId
    ? `/api/library/documents?limit=200&collectionId=${encodeURIComponent(filters.collectionId)}`
    : "/api/library/documents?limit=200";
  const {
    data: documentsData,
    isLoading: documentsLoading,
    mutate: mutateDocuments,
  } = useSWR<DocumentsResponse>(documentsKey, fetcher);

  const collections = collectionsData?.collections ?? [];
  const scopedDocs = documentsData?.documents ?? [];

  useEffect(() => {
    const pendingIds = scopedDocs
      .filter((d) => d.status === "processing" || d.status === "uploading")
      .map((d) => d.id);
    if (pendingIds.length === 0) return;
    const timer = setTimeout(async () => {
      await Promise.all(
        pendingIds.map((id) =>
          fetch(`/api/library/documents/${id}/status`).catch(() => {}),
        ),
      );
      mutateDocuments();
    }, 3000);
    return () => clearTimeout(timer);
  }, [scopedDocs, mutateDocuments]);

  const visibleDocs = useMemo(
    () => applyClientFilters(scopedDocs, filters),
    [scopedDocs, filters],
  );
  const autoTypeCounts = useMemo(() => {
    const docsForChips = applyClientFilters(scopedDocs, filters, "autoType");
    return countBy(docsForChips, (d) => d.autoType ?? null);
  }, [scopedDocs, filters]);
  const autoTypeTotal = useMemo(
    () => applyClientFilters(scopedDocs, filters, "autoType").length,
    [scopedDocs, filters],
  );
  const tagCounts = useMemo(() => {
    const docsForTags = applyClientFilters(scopedDocs, filters, "tag");
    return countBy(docsForTags, (d) => d.autoTags ?? null);
  }, [scopedDocs, filters]);

  const isLoading = collectionsLoading || documentsLoading;

  return (
    <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-6 lg:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">
            Библиотека
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Загрузка…"
              : `${formatDocumentsCount(scopedDocs.length)} · ${formatCollectionsCount(collections.length)}`}
          </p>
        </div>
        <UploadButton
          collectionId={filters.collectionId}
          onUploaded={async () => {
            await Promise.all([mutateDocuments(), mutateCollections()]);
          }}
        />
      </div>

      {isLoading ? (
        <div className="flex min-h-60 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : collections.length === 0 && scopedDocs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center">
          <LibraryIcon className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <h3 className="font-serif text-lg font-semibold text-foreground">
            Ваша Библиотека пуста
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Загрузите документы — договоры, отчёты, книги, статьи. Simply
            сам разложит их по типам и тегам, а в чате сможет на них ссылаться.
          </p>
          <div className="mt-5">
            <UploadButton
              collectionId={null}
              onUploaded={async () => {
                await Promise.all([mutateDocuments(), mutateCollections()]);
              }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <SearchBar
            value={filters.search}
            onChange={(v) => patchFilters({ search: v })}
          />

          <CollectionGrid
            collections={collections}
            activeCollectionId={filters.collectionId}
            onSelect={(id) => patchFilters({ collectionId: id })}
            onCreate={() => setCreateOpen(true)}
            onRename={setRenameColl}
            onDelete={setDeleteColl}
          />

          <FilterChips
            counts={autoTypeCounts}
            totalCount={autoTypeTotal}
            activeValue={filters.autoType}
            onSelect={(v) => patchFilters({ autoType: v })}
          />

          <TagCloud
            counts={tagCounts}
            activeTag={filters.tag}
            onSelect={(t) => patchFilters({ tag: t })}
          />

          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Недавние
              </p>
              <span className="text-xs text-muted-foreground/60">
                {visibleDocs.length}
              </span>
            </div>
            <ActiveFiltersBar
              filters={filters}
              collections={collections}
              onChange={patchFilters}
              onReset={() => setFilters(EMPTY_FILTERS)}
            />
            <div className="mt-3">
              {visibleDocs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-xs text-muted-foreground">
                  Ничего не найдено по текущим фильтрам
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {[...visibleDocs]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    )
                    .map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        document={doc}
                        onOpen={openDocument}
                        onEditCollections={setEditDoc}
                        onDelete={setDeleteDoc}
                      />
                    ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <CreateCollectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async () => {
          await mutateCollections();
        }}
      />

      <EditDocumentCollectionsDialog
        document={editDoc}
        collections={collections}
        onClose={() => setEditDoc(null)}
        onSaved={async () => {
          await Promise.all([mutateDocuments(), mutateCollections()]);
        }}
      />

      <DeleteDocumentDialog
        document={deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onDeleted={async () => {
          await Promise.all([mutateDocuments(), mutateCollections()]);
        }}
      />

      <RenameCollectionDialog
        collection={renameColl}
        onClose={() => setRenameColl(null)}
        onSaved={async () => {
          await mutateCollections();
        }}
      />

      <DeleteCollectionDialog
        collection={deleteColl}
        onClose={() => setDeleteColl(null)}
        onDeleted={async () => {
          await Promise.all([mutateCollections(), mutateDocuments()]);
          if (filters.collectionId === deleteColl?.id) {
            patchFilters({ collectionId: null });
          }
        }}
      />
    </main>
  );
}

function PlaceholderSection({
  title,
  count,
}: {
  title: string;
  count: number | null;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {count !== null && (
          <span className="text-xs text-muted-foreground/60">{count}</span>
        )}
      </div>
      <div className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-xs text-muted-foreground">
        Раздел в разработке
      </div>
    </section>
  );
}

function formatDocumentsCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (count === 0) return "Нет документов";
  if (mod100 >= 11 && mod100 <= 19) return `${count} документов`;
  if (mod10 === 1) return `${count} документ`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} документа`;
  return `${count} документов`;
}

function formatCollectionsCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (count === 0) return "нет коллекций";
  if (mod100 >= 11 && mod100 <= 19) return `${count} коллекций`;
  if (mod10 === 1) return `${count} коллекция`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} коллекции`;
  return `${count} коллекций`;
}
