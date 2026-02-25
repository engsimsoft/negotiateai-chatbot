/**
 * ТЗ-07: Tool Activity UX
 *
 * Config mapping toolName → UI representation for ToolActivityIndicator.
 * Only tools WITHOUT their own renderer are listed here.
 * Tools with custom renderers (getWeather, createDocument, etc.) are handled
 * earlier in message.tsx and never reach the catch-all.
 */

import type { LucideIcon } from "lucide-react";
import { FileText, FlaskConical, FolderOpen, Globe, Pencil, Search, Send, Table2 } from "lucide-react";

export interface ToolActivityConfig {
  icon: LucideIcon;
  activeLabel: string;
  doneLabel: string;
  argsFormatter?: (args: any) => string | null;
  resultFormatter?: (result: any) => string | null;
  /** Extract numeric count from a single result for aggregation across parallel calls */
  resultCounter?: (result: any) => number;
}

export const TOOL_ACTIVITY_CONFIG: Record<string, ToolActivityConfig> = {
  webSearch: {
    icon: Search,
    activeLabel: "Поиск в интернете",
    doneLabel: "Поиск завершён",
    argsFormatter: (args) => args?.query || null,
    resultFormatter: (result) => {
      if (result?.error) return null;
      const count = result?.count ?? result?.results?.length;
      if (typeof count === "number") return `${count} результатов`;
      return null;
    },
    resultCounter: (result) => {
      if (!result || result.error) return 0;
      return result.count ?? result.results?.length ?? 0;
    },
  },

  parseExcel: {
    icon: Table2,
    activeLabel: "Анализирую таблицу",
    doneLabel: "Таблица проанализирована",
    argsFormatter: (args) => {
      if (!args?.fileUrl) return null;
      return args.fileUrl.split("/").pop()?.split("?")[0] || null;
    },
  },

  readProjectFile: {
    icon: FolderOpen,
    activeLabel: "Читаю файл проекта",
    doneLabel: "Файл прочитан",
    argsFormatter: (args) => args?.fileName || null,
  },

  createDocument: {
    icon: FileText,
    activeLabel: "Создаю документ",
    doneLabel: "Документ создан",
    argsFormatter: (args) => args?.title || null,
  },

  updateDocument: {
    icon: Pencil,
    activeLabel: "Обновляю документ",
    doneLabel: "Документ обновлён",
  },

  deepResearch: {
    icon: FlaskConical,
    activeLabel: "Исследую тему",
    doneLabel: "Исследование завершено",
    argsFormatter: (args) => args?.query || null,
    resultFormatter: (result) => {
      if (result?.error) return null;
      const parts: string[] = [];
      if (result?.depth === "deep") parts.push("Deep");
      else parts.push("Pro");
      const count = result?.citationsCount;
      if (typeof count === "number" && count > 0)
        parts.push(`${count} источников`);
      return parts.length > 0 ? parts.join(", ") : null;
    },
  },

  fetchUrl: {
    icon: Globe,
    activeLabel: "Читаю страницу",
    doneLabel: "Страница прочитана",
    argsFormatter: (args) => {
      if (!args?.url) return null;
      try {
        return new URL(args.url).hostname;
      } catch {
        return args.url;
      }
    },
    resultFormatter: (result) => {
      if (result?.error) return null;
      const parts: string[] = [];
      if (result?.title) parts.push(result.title);
      if (typeof result?.originalLength === "number")
        parts.push(`${Math.round(result.originalLength / 1000)}k символов`);
      return parts.length > 0 ? parts.join(" — ") : null;
    },
  },

  readTelegramChannel: {
    icon: Send,
    activeLabel: "Читаю Telegram-канал",
    doneLabel: "Канал прочитан",
    argsFormatter: (args) => {
      if (!args?.channel) return null;
      const ch = args.channel.replace(/^@/, "");
      return `@${ch}`;
    },
    resultFormatter: (result) => {
      if (!result?.isValid) return "Канал недоступен";
      const count = result?.posts?.length;
      if (typeof count === "number") return `${count} постов`;
      return null;
    },
    resultCounter: (result) => {
      if (!result?.isValid) return 0;
      return result?.posts?.length ?? 0;
    },
  },
};
