import type { DocumentItem } from "./types";

export interface LibraryFilters {
  collectionId: string | null;
  autoType: string | null;
  tag: string | null;
  search: string;
}

export const EMPTY_FILTERS: LibraryFilters = {
  collectionId: null,
  autoType: null,
  tag: null,
  search: "",
};

export type ClientFilterKey = "autoType" | "tag" | "search";

export function applyClientFilters(
  docs: DocumentItem[],
  filters: LibraryFilters,
  skip: ClientFilterKey | null = null,
): DocumentItem[] {
  const query = filters.search.trim().toLowerCase();
  return docs.filter((d) => {
    if (skip !== "autoType" && filters.autoType && d.autoType !== filters.autoType) {
      return false;
    }
    if (skip !== "tag" && filters.tag && !d.autoTags?.includes(filters.tag)) {
      return false;
    }
    if (skip !== "search" && query) {
      const hay = [d.filename, d.autoDescription ?? "", ...(d.autoTags ?? [])]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

export function countBy<T extends string>(
  docs: DocumentItem[],
  key: (d: DocumentItem) => T | T[] | null | undefined,
): Map<T, number> {
  const counts = new Map<T, number>();
  for (const d of docs) {
    const value = key(d);
    if (value == null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return counts;
}

export const AUTO_TYPE_LABEL: Record<string, string> = {
  договор: "Договоры",
  отчёт: "Отчёты",
  книга: "Книги",
  статья: "Статьи",
  презентация: "Презентации",
  инструкция: "Инструкции",
  таблица: "Таблицы",
  письмо: "Письма",
  заметка: "Заметки",
  изображение: "Изображения",
  другое: "Прочее",
};

export function labelForAutoType(value: string): string {
  if (AUTO_TYPE_LABEL[value]) return AUTO_TYPE_LABEL[value];
  return value.charAt(0).toUpperCase() + value.slice(1);
}
